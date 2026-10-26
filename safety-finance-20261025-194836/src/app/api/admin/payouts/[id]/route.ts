// src/app/api/admin/payouts/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// Bulletproof schema: accepts 'status' OR 'action', and normalizes the string
const UpdatePayoutSchema = z.object({
  status: z.string().optional(),
  action: z.string().optional(),
  notes: z.string().optional(),
}).transform((data) => {
  // Grab whichever field the frontend sent, default to empty string
  const rawValue = (data.status || data.action || "").toUpperCase().trim();
  
  // Normalize to the exact database enum values
  let normalizedStatus = "PENDING";
  if (rawValue.includes("APPROVE")) normalizedStatus = "APPROVED";
  else if (rawValue.includes("REJECT")) normalizedStatus = "REJECTED";
  else if (rawValue.includes("COMPLETE")) normalizedStatus = "COMPLETED";
  else if (rawValue.includes("FAIL")) normalizedStatus = "FAILED";

  return {
    status: normalizedStatus,
    notes: data.notes || `${normalizedStatus} by admin`,
  };
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: payoutId } = await params;
    const body = await req.json();
    
    console.log("🔍 Received payout update payload:", body); // Debug log

    const parseResult = UpdatePayoutSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, notes } = parseResult.data;
    console.log("✅ Normalized status to:", status); // Debug log

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: { seller: true },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

       if (payout.status !== "PENDING" && payout.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Payout is already ${payout.status.toLowerCase()} and cannot be updated` },
        { status: 400 }
      );
    }

     // Update the payout
    await db.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status,
          processedAt: new Date(),
          processedBy: session.user.id,
          notes: notes || `${status} by admin`,
        },
      });


         // ONLY create the financial record if it was previously PENDING.
      // This prevents deducting the seller's balance twice if we change APPROVED -> COMPLETED.
      if (payout.status === "PENDING" && (status === "APPROVED" || status === "COMPLETED")) {
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId: payout.sellerId,
            orderId: null,
            type: "PAYOUT",
            amount: -payout.amount.toNumber(),
            currency: payout.currency,
            description: `Payout ${status.toLowerCase()} (Ref: ${payoutId.slice(-8).toUpperCase()})`,
          },
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Payout ${status.toLowerCase()} successfully` 
    });
  } catch (error: any) {
    console.error("Update payout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update payout" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: payoutId } = await params;

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        seller: {
          select: {
            businessName: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: payout.id,
      amount: payout.amount.toNumber(),
      currency: payout.currency,
      status: payout.status,
      paymentMethod: payout.paymentMethod,
      paymentDetails: payout.paymentDetails,
      sellerName: payout.seller.businessName,
      sellerEmail: payout.seller.user.email,
      notes: payout.notes,
      createdAt: payout.createdAt,
      processedAt: payout.processedAt,
    });
  } catch (error) {
    console.error("Fetch payout error:", error);
    return NextResponse.json({ error: "Failed to fetch payout" }, { status: 500 });
  }
}