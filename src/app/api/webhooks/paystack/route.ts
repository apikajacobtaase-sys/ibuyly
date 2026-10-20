// src/app/api/webhooks/paystack/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    // 1. Verify webhook signature (Paystack sends this in the header)
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("⚠️ Webhook received without signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const body = await req.text();
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      console.error("⚠️ Webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse the event
    const event = JSON.parse(body);
    const eventType = event.event;
    const data = event.data;

    console.log(`📥 Webhook received: ${eventType} (Reference: ${data.reference})`);

    // 3. Handle different event types
    if (eventType === "charge.success") {
      await handleChargeSuccess(data);
    } else if (eventType === "charge.failed") {
      await handleChargeFailed(data);
    } else {
      console.log(`ℹ️ Ignoring event type: ${eventType}`);
    }

    // 4. Always return 200 to acknowledge receipt (Paystack will retry if we don't)
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    // Still return 200 to prevent Paystack from retrying on our errors
    return NextResponse.json({ received: true });
  }
}

 // Handle successful payment
async function handleChargeSuccess(data: any) {
  const reference = data.reference;
  if (!reference) return;

  const order = await db.order.findFirst({
    where: { paymentReference: reference },
    include: {
      payment: true,
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  seller: { select: { id: true, commissionRate: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    console.error(`⚠️ Order not found for reference: ${reference}`);
    return;
  }

  // IDEMPOTENCY CHECK
  if (order.payment?.status === "SUCCESSFUL" || order.payment?.status === "SUCCESS") {
    console.log(`ℹ️ Payment already verified for order ${order.id}. Skipping.`);
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      // 👇 1. ATOMIC UPDATE: Only update if status is currently PENDING.
      // This prevents race conditions. If a duplicate webhook hits, count will be 0.
      const paymentUpdate = await tx.payment.updateMany({
        where: { 
          orderId: order.id,
          status: "PENDING" 
        },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: data.reference,
          metadata: {
            ...((order.payment?.metadata as any) || {}),
            paystackResponse: data,
            verifiedAt: new Date().toISOString(),
            verifiedVia: "webhook",
          },
        },
      });

      // 👇 2. If count is 0, another process already updated it. Exit safely.
      if (paymentUpdate.count === 0) {
        console.log(`⚠️ Concurrent update detected. Payment already processed. Aborting safely.`);
        return; 
      }

      // 3. Update Order status
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      // 4. MARKETPLACE FINANCE ENGINE
      const sellerTotals = new Map<string, { grossAmount: number; commissionRate: number }>();

      for (const item of order.items) {
        const sellerId = item.variant.product.seller.id;
        const commissionRate = item.variant.product.seller.commissionRate.toNumber();
        const lineTotal = item.price.toNumber() * item.quantity;

        if (!sellerTotals.has(sellerId)) {
          sellerTotals.set(sellerId, { grossAmount: 0, commissionRate });
        }
        const existing = sellerTotals.get(sellerId)!;
        existing.grossAmount += lineTotal;
      }

      for (const [sellerId, sellerData] of sellerTotals.entries()) {
        const commissionAmount = (sellerData.grossAmount * sellerData.commissionRate) / 100;

        await tx.sellerFinancialRecord.create({
          data: {
            sellerId, orderId: order.id, type: "SALE", amount: sellerData.grossAmount,
            currency: "GHS", description: `Order #${order.id.slice(-8).toUpperCase()} - Gross sale`,
          },
        });

        await tx.sellerFinancialRecord.create({
          data: {
            sellerId, orderId: order.id, type: "FEE", amount: -commissionAmount,
            currency: "GHS", description: `Platform commission (${sellerData.commissionRate}%)`,
          },
        });
      }
    }); // Removed Serializable isolation level, as updateMany handles concurrency natively and safer

    console.log(`✅ Order ${order.id} confirmed and finances recorded via webhook.`);
  } catch (error) {
    console.error(`🚨 Transaction failed for order ${order.id}:`, error);
  }
}
// Handle failed payment
async function handleChargeFailed(data: any) {
  const reference = data.reference;
  if (!reference) return;

  const order = await db.order.findFirst({
    where: { paymentReference: reference },
    include: {
      payment: true,
      items: true,
    },
  });

  if (!order) return;

  // If already cancelled or confirmed, skip
  if (order.status === "CANCELLED" || order.status === "CONFIRMED") {
    console.log(`ℹ️ Order ${order.id} already in final state: ${order.status}. Skipping.`);
    return;
  }

  // ATOMIC TRANSACTION: Restore stock + Update Order + Update Payment
  await db.$transaction(
    async (tx) => {
      // 1. Restore stock for each item
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: { increment: item.quantity },
          },
        });
      }

      // 2. Update Order status to CANCELLED
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });

      // 3. Update Payment status to FAILED
      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: {
            status: "FAILED",
            metadata: {
              ...((order.payment.metadata as any) || {}),
              paystackResponse: data,
              failedAt: new Date().toISOString(),
              failureReason: data.gateway_response || "Payment failed",
            },
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );

  console.log(`❌ Order ${order.id} cancelled and stock restored via webhook.`);
}