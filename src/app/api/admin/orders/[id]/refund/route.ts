// src/app/api/orders/[id]/refund/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { reason, amount } = await req.json();

    const order = await db.order.findUnique({
      where: { id },
      include: { payment: true, items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment?.status === "REFUNDED") {
      return NextResponse.json({ error: "Order already refunded" }, { status: 400 });
    }

    const refundAmount = amount ? parseFloat(amount) : parseFloat(order.totalAmount.toString());

    // Attempt Paystack refund if payment was via Paystack
    let paystackRefundSuccess = false;
    if (order.payment?.provider === "PAYSTACK" && order.payment.providerTransactionId) {
      try {
        const refundResponse = await fetch("https://api.paystack.co/refund", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: order.payment.providerTransactionId,
            amount: Math.round(refundAmount * 100), // Paystack uses kobo
          }),
        });

        const refundData = await refundResponse.json();
        paystackRefundSuccess = refundData.status === true;
      } catch (error) {
        console.error("Paystack refund API error:", error);
        // Continue with manual refund marking
      }
    }

    // Update order and payment status
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: "REFUNDED" },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "REFUNDED" },
        });
      }

      // Record refund in financial ledger for each seller
      const sellerTotals = new Map<string, number>();
      for (const item of order.items) {
        const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
        const itemTotal = price * item.quantity;
        const current = sellerTotals.get(item.sellerId) || 0;
        sellerTotals.set(item.sellerId, current + itemTotal);
      }

      for (const [sellerId, sellerAmount] of sellerTotals.entries()) {
        const sellerRefund = (sellerAmount / parseFloat(order.totalAmount.toString())) * refundAmount;
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: id,
            type: "REFUND",
            amount: -sellerRefund,
            description: `Refund for order #${id.slice(-8).toUpperCase()}: ${reason || "No reason provided"}`,
          },
        });
      }
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ORDER_REFUNDED",
        resourceType: "Order",
        resourceId: id,
        metadata: {
          amount: refundAmount,
          reason,
          paystackRefundSuccess,
        },
      },
    });

    return NextResponse.json({
      success: true,
      paystackRefundSuccess,
      message: paystackRefundSuccess
        ? "Refund processed via Paystack"
        : "Refund recorded manually (Paystack refund not attempted or failed)",
    });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}