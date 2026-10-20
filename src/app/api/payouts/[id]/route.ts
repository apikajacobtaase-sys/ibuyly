// src/app/api/admin/payouts/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { action, notes } = await req.json();

    const payout = await db.payout.findUnique({
      where: { id },
      include: { seller: true },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    if (payout.status !== "PENDING") {
      return NextResponse.json({ error: "Payout already processed" }, { status: 400 });
    }

    if (action === "APPROVE") {
      await db.$transaction(async (tx) => {
        await tx.payout.update({
          where: { id },
          data: {
            status: "APPROVED",
            processedBy: session.user.id,
            processedAt: new Date(),
            notes: notes || null,
          },
        });

        // Record the payout in the financial ledger
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId: payout.sellerId,
            type: "PAYOUT",
            amount: -payout.amount,
            description: `Payout approved by admin #${id.slice(-8).toUpperCase()}`,
          },
        });
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PAYOUT_APPROVED",
          resourceType: "Payout",
          resourceId: id,
          metadata: { amount: payout.amount.toString(), sellerId: payout.sellerId },
        },
      });
    } else if (action === "REJECT") {
      await db.payout.update({
        where: { id },
        data: {
          status: "FAILED",
          processedBy: session.user.id,
          processedAt: new Date(),
          notes: notes || "Rejected by admin",
        },
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PAYOUT_REJECTED",
          resourceType: "Payout",
          resourceId: id,
          metadata: { amount: payout.amount.toString(), notes },
        },
      });
    } else if (action === "COMPLETE") {
      await db.payout.update({
        where: { id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          notes: notes || "Marked as completed",
        },
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PAYOUT_COMPLETED",
          resourceType: "Payout",
          resourceId: id,
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payout action error:", error);
    return NextResponse.json({ error: "Failed to process payout" }, { status: 500 });
  }
}