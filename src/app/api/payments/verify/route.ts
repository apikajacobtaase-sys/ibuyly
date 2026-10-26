 // src/app/api/payments/verify/route.ts

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PaystackVerificationResponse = {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    [key: string]: unknown;
  };
};

type SellerTotal = {
  grossCents: number;
  commissionRate: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid monetary value.");
  }

  return Math.round(value * 100);
}

export async function POST(req: Request) {
  try {
    // 1. Validate the request body.
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonError("A valid JSON request body is required.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("reference" in body) ||
      typeof body.reference !== "string" ||
      body.reference.trim().length === 0 ||
      body.reference.length > 200
    ) {
      return jsonError(
        "A valid payment reference is required.",
        400
      );
    }

    const paymentReference = body.reference.trim();

    // 2. Find the order and its payment.
    const order = await db.order.findUnique({
      where: {
        paymentReference,
      },
      include: {
        payment: true,
        items: {
          include: {
            offer: {
              include: {
                seller: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return jsonError(
        "Order not found for this payment reference.",
        404
      );
    }

    if (!order.payment) {
      return jsonError(
        "No payment record exists for this order.",
        409
      );
    }

    // 3. Idempotency check.
    if (order.payment.status === "SUCCESSFUL") {
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

    if (order.status !== "PENDING") {
      return jsonError(
        "This order is no longer pending.",
        409
      );
    }

    // 4. Verify the transaction directly with Paystack.
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "[PAYMENT VERIFY] PAYSTACK_SECRET_KEY is not configured."
      );

      return jsonError(
        "Payment verification is temporarily unavailable.",
        500
      );
    }

    let paystackResponse: Response;

    try {
      paystackResponse = await fetch(
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
    } catch {
      // Do not change the payment state if Paystack cannot be reached.
      return NextResponse.json(
        {
          error:
            "Unable to reach Paystack. Please retry verification.",
        },
        { status: 503 }
      );
    }

    let paystackResult: PaystackVerificationResponse;

    try {
      paystackResult =
        (await paystackResponse.json()) as PaystackVerificationResponse;
    } catch {
      return jsonError(
        "Paystack returned an invalid verification response.",
        502
      );
    }

    if (
      !paystackResponse.ok ||
      paystackResult.status !== true ||
      !paystackResult.data
    ) {
      // Do not mark the payment failed just because verification
      // could not confirm it. The transaction may still be pending.
      return NextResponse.json(
        {
          error:
            "Paystack could not verify this transaction. Please retry.",
        },
        { status: 502 }
      );
    }

    const transaction = paystackResult.data;

    // 5. Validate every critical transaction field.
    if (
      transaction.status !== "success" ||
      transaction.reference !== paymentReference
    ) {
      return jsonError(
        "Paystack has not confirmed a successful matching transaction.",
        400
      );
    }

    if (
      typeof transaction.amount !== "number" ||
      !Number.isSafeInteger(transaction.amount) ||
      transaction.amount <= 0
    ) {
      return jsonError(
        "Paystack returned an invalid transaction amount.",
        400
      );
    }

    if (
      typeof transaction.currency !== "string" ||
      transaction.currency.trim().length === 0
    ) {
      return jsonError(
        "Paystack returned an invalid transaction currency.",
        400
      );
    }

    const expectedAmountCents = toCents(
      order.payment.amount.toNumber()
    );

    if (transaction.amount !== expectedAmountCents) {
      console.error(
        `[PAYMENT VERIFY] Amount mismatch for order ${order.id}.`
      );

      return jsonError(
        "The transaction amount does not match the order payment.",
        400
      );
    }

    if (
      transaction.currency.toUpperCase() !==
      order.payment.currency.toUpperCase()
    ) {
      console.error(
        `[PAYMENT VERIFY] Currency mismatch for order ${order.id}.`
      );

      return jsonError(
        "The transaction currency does not match the order payment.",
        400
      );
    }

    // Serialize the external response into a Prisma-compatible JSON value.
    const responseJson = JSON.parse(
      JSON.stringify(transaction)
    ) as Prisma.InputJsonValue;

    // 6. Atomically claim the pending payment and confirm the order.
    //
    // The webhook uses the same PENDING -> SUCCESSFUL transition.
    // Only the request that successfully claims the payment may
    // create seller financial records.
    const result = await db.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
        },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: paymentReference,
          metadata: {
            paystackResponse: responseJson,
            verifiedAt: new Date().toISOString(),
            verifiedVia: "verify",
          },
        },
      });

      if (claim.count === 0) {
        // The webhook or another verification request won the race.
        return {
          claimed: false,
        };
      }

      const orderUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
        },
        data: {
          status: "CONFIRMED",
        },
      });

      if (orderUpdate.count !== 1) {
        // Throwing rolls back the payment claim as well.
        throw new Error(
          `Could not confirm pending order ${order.id}.`
        );
      }

      // 7. Aggregate sales by the actual seller offer.
      const sellerTotals = new Map<string, SellerTotal>();

      for (const item of order.items) {
        if (!item.sellerId || !item.offerId || !item.offer) {
          throw new Error(
            `Order item ${item.id} is missing its seller offer.`
          );
        }

        const offer = await tx.sellerOffer.findUnique({
          where: {
            id: item.offerId,
          },
          select: {
            id: true,
            sellerId: true,
            seller: {
              select: {
                id: true,
                commissionRate: true,
              },
            },
          },
        });

        if (
          !offer ||
          offer.sellerId !== item.sellerId ||
          offer.seller.id !== item.sellerId
        ) {
          throw new Error(
            `Seller ownership validation failed for order item ${item.id}.`
          );
        }

        const unitPriceCents = toCents(item.price.toNumber());
        const lineCents = unitPriceCents * item.quantity;

        if (
          !Number.isSafeInteger(lineCents) ||
          lineCents < 0
        ) {
          throw new Error(
            `Invalid line total for order item ${item.id}.`
          );
        }

        const commissionRate = offer.seller.commissionRate.toNumber();
        const existing = sellerTotals.get(item.sellerId);

        if (existing) {
          existing.grossCents += lineCents;

          if (!Number.isSafeInteger(existing.grossCents)) {
            throw new Error(
              `Invalid aggregated seller total for ${item.sellerId}.`
            );
          }
        } else {
          sellerTotals.set(item.sellerId, {
            grossCents: lineCents,
            commissionRate,
          });
        }
      }

      // 8. Create financial records within the same transaction.
      for (const [sellerId, sellerData] of sellerTotals) {
        const commissionCents = Math.round(
          (sellerData.grossCents * sellerData.commissionRate) /
            100
        );

        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "SALE",
            amount: sellerData.grossCents / 100,
            currency: order.payment!.currency,
            description: `Order #${order.id
              .slice(-8)
              .toUpperCase()} - Gross sale`,
          },
        });

        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "FEE",
            amount: -commissionCents / 100,
            currency: order.payment!.currency,
            description: `Platform commission (${sellerData.commissionRate}%)`,
          },
        });
      }

      return {
        claimed: true,
      };
    });

    // 9. Handle a concurrent request safely.
    if (!result.claimed) {
      const latestPayment = await db.payment.findUnique({
        where: {
          orderId: order.id,
        },
        select: {
          status: true,
        },
      });

      if (latestPayment?.status === "SUCCESSFUL") {
        return NextResponse.json({
          success: true,
          alreadyVerified: true,
          orderId: order.id,
          message: "Payment has already been verified.",
        });
      }

      return NextResponse.json(
        {
          error:
            "The payment state changed during verification. Please check the order and retry if necessary.",
          paymentStatus: latestPayment?.status ?? "UNKNOWN",
        },
        { status: 409 }
      );
    }

    console.info(
      `[PAYMENT VERIFY] Payment confirmed successfully for order ${order.id}.`
    );

    return NextResponse.json({
      success: true,
      alreadyVerified: false,
      orderId: order.id,
      message: "Payment verified and order confirmed.",
    });
  } catch (error: unknown) {
    // Log server-side details without exposing internal errors to clients.
    console.error("[PAYMENT VERIFY] Verification error:", error);

    return jsonError(
      "Payment verification failed. Please retry or contact support.",
      500
    );
  }
}