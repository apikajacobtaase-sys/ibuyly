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
    const { user, error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClause: any = {};
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    const payouts = await db.payout.findMany({
      where: whereClause,
      include: {
        seller: {
          select: {
            businessName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    const formattedPayouts = payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      paymentReference: p.paymentReference,
      adminNotes: p.adminNotes,
      rejectionReason: p.rejectionReason,
      requestedAt: p.requestedAt,
      processedAt: p.processedAt,
      paidAt: p.paidAt,
      seller: {
        businessName: p.seller.businessName,
        email: p.seller.user.email,
      },
    }));

    return NextResponse.json({ payouts: formattedPayouts });
  } catch (error: any) {
    console.error("🚨 Admin payouts GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdatePayoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    const { payoutId, status, paymentReference, adminNotes, rejectionReason } = validation.data;

    const payout = await db.payout.findUnique({ where: { id: payoutId } });
    if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

    const updateData: any = { status };

    if (status === "APPROVED" || status === "PROCESSING") {
      updateData.processedAt = new Date();
    }
    if (status === "PAID") {
      updateData.paidAt = new Date();
      updateData.processedAt = payout.processedAt || new Date();
    }
    if (paymentReference) updateData.paymentReference = paymentReference;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;

    await db.payout.update({
      where: { id: payoutId },
      data: updateData,
    });

    // Notify seller
    let title = "";
    let message = "";
    if (status === "APPROVED") {
      title = "💰 Your payout has been approved!";
      message = `Your payout of GH₵ ${Number(payout.amount).toFixed(2)} is being processed.`;
    } else if (status === "PAID") {
      title = "✅ Your payout has been sent!";
      message = `GH₵ ${Number(payout.amount).toFixed(2)} has been successfully transferred to your account.`;
    } else if (status === "REJECTED") {
      title = "❌ Your payout request was rejected";
      message = rejectionReason || "Please contact support for more information.";
    }

    if (title) {
      await db.notification.create({
        data: {
          userId: (await db.sellerProfile.findUnique({ where: { id: payout.sellerId } }))!.userId,
          sellerId: payout.sellerId,
          type: "SYSTEM",
          title,
          message,
          link: "/seller/payouts",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🚨 Admin payouts PATCH error:", error);
    return NextResponse.json({ error: error.message || "Failed to update payout" }, { status: 500 });
  }
}