 // src/app/api/payments/verify/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Validate the request
    const body = await req.json();
    const reference = body.reference;

    if (typeof reference !== "string" || reference.trim().length === 0) {
      return NextResponse.json({ error: "A valid payment reference is required." }, { status: 400 });
    }

    const paymentReference = reference.trim();
    console.log(`[PAYMENT VERIFY] Starting verification: ${paymentReference}`);

    // 2. Find the existing order and payment
    const order = await db.order.findUnique({
      where: { paymentReference },
      include: {
        payment: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found for this payment reference." }, { status: 404 });
    }

    if (!order.payment) {
      return NextResponse.json({ error: "No payment record exists for this order." }, { status: 409 });
    }

    // 3. Idempotency Check: If already successful, return success immediately
    if (order.payment.status === "SUCCESSFUL") {
      console.log(`[PAYMENT VERIFY] Already verified: ${order.id}`);
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        orderId: order.id,
        message: "Payment has already been verified.",
      });
    }

    if (order.payment.status !== "PENDING") {
      return NextResponse.json({ error: "This payment is no longer pending.", paymentStatus: order.payment.status }, { status: 409 });
    }

    // 4. Verify with Paystack
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 500 });
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentReference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    const paystackResult = await paystackResponse.json();

    if (!paystackResponse.ok || paystackResult.status !== true || !paystackResult.data) {
      return NextResponse.json({ error: paystackResult.message || "Paystack could not verify this transaction." }, { status: 400 });
    }

    const transaction = paystackResult.data;

    // 5. Validate Transaction Details
    if (transaction.status !== "success") {
      return NextResponse.json({ error: "Paystack has not marked this transaction successful." }, { status: 400 });
    }

    if (transaction.reference !== paymentReference) {
      return NextResponse.json({ error: "The transaction reference does not match." }, { status: 400 });
    }

    // 6. Update Database in Transaction
    await db.$transaction(async (tx) => {
      // ✅ FIX: Use 'update' with specific ID instead of 'updateMany'
      if (!order.payment?.id) throw new Error("Payment ID missing");

      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: paymentReference,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      // 7. Create Financial Records
      const sellerTotals = new Map<string, { grossAmount: number; commissionRate: number }>();

      for (const item of order.items) {
        const seller = item.variant?.product?.seller;
        if (!seller) continue;

        const sellerId = seller.id;
        const commissionRate = Number(seller.commissionRate.toString());
        const lineTotal = Number(item.price.toString()) * item.quantity;

        if (!sellerTotals.has(sellerId)) {
          sellerTotals.set(sellerId, { grossAmount: 0, commissionRate });
        }
        const existing = sellerTotals.get(sellerId)!;
        existing.grossAmount += lineTotal;
      }

      for (const [sellerId, data] of sellerTotals.entries()) {
        const commissionAmount = (data.grossAmount * data.commissionRate) / 100;

        // Check for existing records to prevent duplicates on retry
        const existingSale = await tx.sellerFinancialRecord.findFirst({
          where: { sellerId, orderId: order.id, type: "SALE" },
        });

        if (!existingSale) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: order.id,
              type: "SALE",
              amount: Number(data.grossAmount.toFixed(2)),
              currency: "GHS",
              description: `Order #${order.id.slice(-8).toUpperCase()} - Gross sale`,
            },
          });
        }

        const existingFee = await tx.sellerFinancialRecord.findFirst({
          where: { sellerId, orderId: order.id, type: "FEE" },
        });

        if (!existingFee) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: order.id,
              type: "FEE",
              amount: -Number(commissionAmount.toFixed(2)),
              currency: "GHS",
              description: `Platform commission (${data.commissionRate}%)`,
            },
          });
        }
      }
    });

    console.log(`[PAYMENT VERIFY] Payment confirmed successfully: ${order.id}`);
    return NextResponse.json({ success: true, orderId: order.id, message: "Payment verified and order confirmed." });

  } catch (error: unknown) {
    console.error("[PAYMENT VERIFY] Verification error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: "Payment verification failed.", details: process.env.NODE_ENV === "development" ? message : undefined }, { status: 500 });
  }
}