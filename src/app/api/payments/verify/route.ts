 // src/app/api/payments/verify/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Validate the request
    const body = await req.json();
    const reference = body.reference;

    if (
      typeof reference !== "string" ||
      reference.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A valid payment reference is required." },
        { status: 400 }
      );
    }

    const paymentReference = reference.trim();

    console.log(
      `[PAYMENT VERIFY] Starting verification: ${paymentReference}`
    );

    // 2. Find the existing order and payment
    const order = await db.order.findUnique({
      where: {
        paymentReference,
      },
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
      console.error(
        `[PAYMENT VERIFY] Order not found: ${paymentReference}`
      );

      return NextResponse.json(
        { error: "Order not found for this payment reference." },
        { status: 404 }
      );
    }

    if (!order.payment) {
      return NextResponse.json(
        { error: "No payment record exists for this order." },
        { status: 409 }
      );
    }

    if (order.payment.provider !== "PAYSTACK") {
      return NextResponse.json(
        { error: "This order does not use Paystack." },
        { status: 400 }
      );
    }

    // 3. Check the server-side Paystack configuration
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "[PAYMENT VERIFY] PAYSTACK_SECRET_KEY is not configured."
      );

      return NextResponse.json(
        { error: "Payment verification is temporarily unavailable." },
        { status: 500 }
      );
    }

    // 4. Ask Paystack to verify the transaction
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        paymentReference
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    const paystackResult = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      paystackResult.status !== true ||
      !paystackResult.data
    ) {
      console.error(
        "[PAYMENT VERIFY] Paystack verification rejected:",
        paystackResult.message || paystackResponse.status
      );

      return NextResponse.json(
        {
          error:
            paystackResult.message ||
            "Paystack could not verify this transaction.",
        },
        { status: 400 }
      );
    }

    const transaction = paystackResult.data;

    // 5. Verify the transaction reference
    if (transaction.reference !== paymentReference) {
      console.error(
        "[PAYMENT VERIFY] Transaction reference mismatch."
      );

      return NextResponse.json(
        { error: "The transaction reference does not match." },
        { status: 400 }
      );
    }

    // 6. Verify the transaction status
    if (transaction.status !== "success") {
      return NextResponse.json(
        {
          error: "Paystack has not marked this transaction successful.",
          paymentStatus: transaction.status,
        },
        { status: 400 }
      );
    }

    // 7. Verify amount and currency
    // Paystack amounts are expressed in pesewas for GHS transactions.
    const expectedAmount = Math.round(
      Number(order.totalAmount.toString()) * 100
    );

    const actualAmount = Number(transaction.amount);

    if (
      !Number.isSafeInteger(actualAmount) ||
      actualAmount !== expectedAmount
    ) {
      console.error(
        "[PAYMENT VERIFY] Amount mismatch:",
        {
          expectedAmount,
          actualAmount,
        }
      );

      return NextResponse.json(
        {
          error: "The verified payment amount does not match the order.",
        },
        { status: 400 }
      );
    }

    if (
      String(transaction.currency).toUpperCase() !== "GHS" ||
      order.payment.currency.toUpperCase() !== "GHS"
    ) {
      return NextResponse.json(
        { error: "The transaction currency does not match the order." },
        { status: 400 }
      );
    }

    // Also ensure the order and payment agree about the amount.
    const expectedPaymentAmount = Math.round(
      Number(order.payment.amount.toString()) * 100
    );

    if (actualAmount !== expectedPaymentAmount) {
      return NextResponse.json(
        { error: "The payment amount does not match the payment record." },
        { status: 400 }
      );
    }

    // 8. Handle already-verified transactions safely.
    if (order.payment.status === "SUCCESSFUL") {
      console.log(
        `[PAYMENT VERIFY] Already verified: ${order.id}`
      );

      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        orderId: order.id,
        message: "Payment has already been verified.",
      });
    }

    if (order.payment.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "This payment is no longer pending.",
          paymentStatus: order.payment.status,
        },
        { status: 409 }
      );
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return NextResponse.json(
        {
          error: "This order cannot be confirmed in its current state.",
          orderStatus: order.status,
        },
        { status: 409 }
      );
    }

    // 9. Confirm the payment and create seller financial records
    // in one database transaction.
    //
    // Only the request that successfully changes PENDING to SUCCESSFUL
    // is allowed to create the financial records.
    await db.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
          provider: "PAYSTACK",
        },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: paymentReference,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new Error(
          "Payment state changed during verification. Please retry."
        );
      }

      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: "CONFIRMED",
        },
      });

      // Calculate gross sales per seller.
      const sellerTotals = new Map<
        string,
        {
          grossAmount: number;
          commissionRate: number;
        }
      >();

      for (const item of order.items) {
        const seller = item.variant.product.seller;

        if (!seller) {
          console.error(
            `[PAYMENT VERIFY] Missing seller for order item ${item.id}.`
          );

          continue;
        }

        const sellerId = seller.id;
        const commissionRate = Number(
          seller.commissionRate.toString()
        );

        const lineTotal =
          Number(item.price.toString()) * item.quantity;

        const existing = sellerTotals.get(sellerId);

        if (existing) {
          existing.grossAmount += lineTotal;
        } else {
          sellerTotals.set(sellerId, {
            grossAmount: lineTotal,
            commissionRate,
          });
        }
      }

      // Create the seller's SALE and FEE records.
      for (const [sellerId, data] of sellerTotals.entries()) {
        const existingSale = await tx.sellerFinancialRecord.findFirst({
          where: {
            sellerId,
            orderId: order.id,
            type: "SALE",
          },
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
          where: {
            sellerId,
            orderId: order.id,
            type: "FEE",
          },
        });

        if (!existingFee) {
          const commissionAmount =
            (data.grossAmount * data.commissionRate) / 100;

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

    console.log(
      `[PAYMENT VERIFY] Payment confirmed successfully: ${order.id}`
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: "Payment verified and order confirmed.",
    });
  } catch (error: unknown) {
    console.error("[PAYMENT VERIFY] Verification error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    return NextResponse.json(
      {
        error: "Payment verification failed.",
        details:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 }
    );
  }
}