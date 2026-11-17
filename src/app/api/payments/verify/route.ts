 import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-successful-payment";

export const runtime = "nodejs";

type PaystackVerificationResponse = {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    gateway_response?: string;
    [key: string]: unknown;
  };
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

async function handleFailedPayment(
  order: {
    id: string;
    discountCodeId: string | null;
    items: Array<{
      id: string;
      offerId: string | null;
      sellerId: string | null;
      quantity: number;
      flashDealId: string | null;
    }>;
  },
  payment: {
    amount: { toNumber(): number };
    currency: string;
  },
  transaction: NonNullable<PaystackVerificationResponse["data"]>
) {
  await db.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        metadata: {
          paystackResponse: JSON.parse(
            JSON.stringify(transaction)
          ) as Prisma.InputJsonValue,
          failedAt: new Date().toISOString(),
          failureReason:
            typeof transaction.gateway_response === "string"
              ? transaction.gateway_response
              : "Payment failed",
          verifiedVia: "verify",
        },
      },
    });

    if (claim.count === 0) {
      return;
    }

    const orderUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });

    if (orderUpdate.count !== 1) {
      throw new Error(
        `Order ${order.id} could not be cancelled after payment failure.`
      );
    }

    for (const item of order.items) {
      if (!item.offerId) {
        throw new Error(
          `Order item ${item.id} has no offerId; inventory restoration needs reconciliation.`
        );
      }

      const restored = await tx.sellerOffer.updateMany({
        where: {
          id: item.offerId,
          sellerId: item.sellerId ?? undefined,
        },
        data: {
          stockQuantity: {
            increment: item.quantity,
          },
        },
      });

      if (restored.count !== 1) {
        throw new Error(
          `Could not restore seller-offer inventory for order item ${item.id}.`
        );
      }

      if (item.flashDealId) {
        const released = await tx.flashDeal.updateMany({
          where: {
            id: item.flashDealId,
            reservedQuantity: {
              gte: item.quantity,
            },
          },
          data: {
            reservedQuantity: {
              decrement: item.quantity,
            },
          },
        });

        if (released.count !== 1) {
          throw new Error(
            `Could not release flash-deal reservation for order item ${item.id}.`
          );
        }
      }
    }

    if (order.discountCodeId) {
      await tx.discountCode.updateMany({
        where: {
          id: order.discountCodeId,
          usedCount: {
            gt: 0,
          },
        },
        data: {
          usedCount: {
            decrement: 1,
          },
        },
      });
    }
  });
}

export async function POST(req: Request) {
  try {
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
      return jsonError("A valid payment reference is required.", 400);
    }

    const paymentReference = body.reference.trim();

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
      return jsonError("Order not found for this payment reference.", 404);
    }

    if (!order.payment) {
      return jsonError("No payment record exists for this order.", 409);
    }

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
      return jsonError("This order is no longer pending.", 409);
    }

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
      return NextResponse.json(
        {
          error: "Unable to reach Paystack. Please retry verification.",
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
      return NextResponse.json(
        {
          error:
            "Paystack could not verify this transaction. Please retry.",
        },
        { status: 502 }
      );
    }

    const transaction = paystackResult.data;

    if (transaction.reference !== paymentReference) {
      return jsonError(
        "Paystack transaction reference does not match the order.",
        400
      );
    }

    if (
      transaction.status !== "success" &&
      transaction.status !== "failed"
    ) {
      return NextResponse.json(
        {
          error: "Payment has not reached a final status.",
          transactionStatus: transaction.status ?? "UNKNOWN",
          message: "Please retry verification later.",
        },
        { status: 409 }
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

    // Handle confirmed failed transactions.
    if (transaction.status === "failed") {
      await handleFailedPayment(
        {
          id: order.id,
          discountCodeId: order.discountCodeId,
          items: order.items.map((item) => ({
            id: item.id,
            offerId: item.offerId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            flashDealId: item.flashDealId,
          })),
        },
        order.payment,
        transaction
      );

      const latestPayment = await db.payment.findUnique({
        where: {
          orderId: order.id,
        },
        select: {
          status: true,
        },
      });

      if (latestPayment?.status === "FAILED") {
        console.info(
          `[PAYMENT VERIFY] Failed payment processed and reservations released for order ${order.id}.`
        );

        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          orderStatus: "CANCELLED",
          orderId: order.id,
          message:
            "Payment failed. Inventory and flash-deal reservations have been restored.",
        });
      }

      return NextResponse.json(
        {
          error: "Payment state changed during failure processing.",
          paymentStatus: latestPayment?.status ?? "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const responseJson = JSON.parse(
      JSON.stringify(transaction)
    ) as Prisma.InputJsonValue;

    const result = await confirmSuccessfulPayment({
      reference: paymentReference,
      verifiedVia: "verify",
      paystackResponse: responseJson,
    });

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
    console.error("[PAYMENT VERIFY] Verification error:", error);

    return jsonError(
      "Payment verification failed. Please retry or contact support.",
      500
    );
  }
}