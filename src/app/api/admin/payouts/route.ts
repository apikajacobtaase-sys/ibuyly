// src/app/api/admin/payouts/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const UpdatePayoutSchema = z.object({
  payoutId: z.string().cuid("Invalid payout ID"),
  status: z.enum(["APPROVED", "PROCESSING", "PAID", "REJECTED", "FAILED"]),
  paymentReference: z.string().optional(),
  adminNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClause = {
      ...(status && status !== "ALL" ? { status } : {}),
    };

    const payouts = await db.payout.findMany({
      where: whereClause,
      include: {
        seller: {
          select: {
            businessName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedPayouts = payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      paymentDetails: p.paymentDetails,
      adminNotes: p.notes,
      requestedAt: p.createdAt,
      processedAt: p.processedAt,
      paidAt: p.status === "PAID" ? p.processedAt : null,
      seller: {
        businessName: p.seller.businessName,
        email: p.seller.user.email,
      },
    }));

    return NextResponse.json({ payouts: formattedPayouts });
  } catch (error: unknown) {
    console.error("Admin payouts GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdatePayoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      payoutId,
      status,
      paymentReference,
      adminNotes,
      rejectionReason,
    } = validation.data;

    const result = await db.$transaction(async (tx) => {
      // Lock the payout row so concurrent admin requests cannot
      // simultaneously validate and process the same payout.
      const lockedRows = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT id
        FROM payouts
        WHERE id = ${payoutId}
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        return {
          error: "Payout not found",
          statusCode: 404,
        } as const;
      }

      // Read the payout only after acquiring the row lock.
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        return {
          error: "Payout not found",
          statusCode: 404,
        } as const;
      }

      // Only allow the intended status transitions.
      const allowedTransitions: Record<string, string[]> = {
        PENDING: ["APPROVED", "REJECTED"],
        APPROVED: ["PROCESSING", "PAID", "FAILED"],
        PROCESSING: ["PAID", "FAILED"],
      };

      if (!allowedTransitions[payout.status]?.includes(status)) {
        return {
          error:
            payout.status === "PAID"
              ? "This payout has already been marked as paid."
              : `Cannot change payout status from ${payout.status} to ${status}.`,
          statusCode: 409,
        } as const;
      }

      // A paid payout must have a transaction reference.
      if (status === "PAID" && !paymentReference?.trim()) {
        return {
          error: "A payment reference is required before marking a payout as paid.",
          statusCode: 400,
        } as const;
      }

      const now = new Date();

      // Preserve all existing payment details.
      const existingDetails =
        payout.paymentDetails &&
        typeof payout.paymentDetails === "object" &&
        !Array.isArray(payout.paymentDetails)
          ? (payout.paymentDetails as Record<string, unknown>)
          : {};

      const trimmedReference = paymentReference?.trim();

      const updatedPaymentDetails =
        trimmedReference || status === "PAID"
          ? {
              ...existingDetails,
              ...(trimmedReference
                ? { paymentReference: trimmedReference }
                : {}),
            }
          : undefined;

      const notesParts = [
        adminNotes?.trim(),
        rejectionReason?.trim()
          ? `Rejection reason: ${rejectionReason.trim()}`
          : undefined,
      ].filter(Boolean);

      const updateData = {
        status,
        ...(status === "APPROVED" ||
        status === "PROCESSING" ||
        status === "PAID"
          ? { processedAt: payout.processedAt ?? now }
          : {}),
        ...(status === "PAID"
          ? { processedBy: user?.id ?? undefined }
          : {}),
        ...(updatedPaymentDetails
          ? { paymentDetails: updatedPaymentDetails }
          : {}),
        ...(notesParts.length > 0
          ? {
              notes: [
                payout.notes,
                notesParts.join("\n"),
              ]
                .filter(Boolean)
                .join("\n"),
            }
          : {}),
      };

               const updatedPayout = await tx.payout.update({
        where: { id: payoutId },
        data: updateData,
      });

      // Record the payout deduction exactly once, in the same transaction.
      if (status === "PAID") {
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId: payout.sellerId,
            type: "PAYOUT",
            amount: -payout.amount,
            currency: payout.currency,
            description: `Verified payout ${payout.id}; reference: ${trimmedReference}`,
          },
        });
      }

      return {
        updatedPayout,
        sellerId: payout.sellerId,
        status,
        paymentReference: trimmedReference,
        rejectionReason: rejectionReason?.trim(),
        adminNotes: adminNotes?.trim(),
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }
       const {
  updatedPayout,
  sellerId,
  paymentReference: savedReference,
  rejectionReason: savedRejectionReason,
  adminNotes: savedAdminNotes,
} = result;

    // Keep the existing seller notification behavior.
    let title = "";
    let message = "";

    if (status === "APPROVED") {
      title = "Your payout has been approved!";
      message = `Your payout of ${updatedPayout.currency} ${Number(
        updatedPayout.amount
      ).toFixed(2)} is being processed.`;
    } else if (status === "PROCESSING") {
      title = "Your payout is being processed";
      message = `Your payout of ${updatedPayout.currency} ${Number(
        updatedPayout.amount
      ).toFixed(2)} is being processed.`;
    } else if (status === "PAID") {
      title = "Your payout has been sent!";

      message = `${updatedPayout.currency} ${Number(
        updatedPayout.amount
      ).toFixed(2)} has been marked as paid.${
        savedReference
          ? ` Payment reference: ${savedReference}.`
          : ""
      }`;
    } else if (status === "REJECTED") {
      title = "Your payout request was rejected";
     message =
  savedRejectionReason ||
  "Please contact support for more information.";
    } else if (status === "FAILED") {
      title = "Your payout failed";
      message =
  savedAdminNotes ||
  "Please contact support for more information.";
    }

    // Notify only after the status change has committed successfully.
    if (title && message) {
      const seller = await db.sellerProfile.findUnique({
        where: { id: sellerId },
        select: { userId: true },
      });

      if (seller?.userId) {
        await db.notification.create({
          data: {
            userId: seller.userId,
            sellerId,
            type: "SYSTEM",
            title,
            message,
            link: "/seller/payouts",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payout updated successfully",
      payout: {
        id: updatedPayout.id,
        status: updatedPayout.status,
        processedAt: updatedPayout.processedAt,
        paymentDetails: updatedPayout.paymentDetails,
        notes: updatedPayout.notes,
      },
      notification: { title, message },
    });
  } catch (error: unknown) {
    console.error("Admin payouts PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update payout" },
      { status: 500 }
    );
  }
}
