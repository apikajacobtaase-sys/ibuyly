import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-successful-payment";
import crypto from "crypto";
import { finalizeRefundOperation } from "@/lib/refunds/finalize-refund-operation";
export const runtime = "nodejs";

type PaystackEventData = {
  reference?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  gateway_response?: string;
  [key: string]: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify Paystack's HMAC-SHA512 signature against the exact raw request body.
 */
function verifySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!/^[a-f0-9]{128}$/i.test(signature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest();

  const supplied = Buffer.from(signature, "hex");

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}

/**
 * Validate the Paystack transaction against the persisted payment.
 * Paystack reports amounts in the currency's minor unit (pesewas for GHS).
 */
function validateSuccessfulTransaction(
  data: PaystackEventData,
  payment: {
    amount: { toNumber(): number };
    currency: string;
  },
  reference: string
): boolean {
  if (data.reference !== reference) {
    return false;
  }

  if (data.status !== "success") {
    return false;
  }

  if (
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    data.amount <= 0
  ) {
    return false;
  }

  if (
    typeof data.currency !== "string" ||
    data.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    return false;
  }

  const expectedCents = Math.round(payment.amount.toNumber() * 100);

  return data.amount === expectedCents;
}

/**
 * Confirm a successful transaction.
 *
 * The conditional payment update is the idempotency gate shared with
 * the payment verification endpoint. Order confirmation and financial
 * records are committed in the same transaction.
 */
async function handleChargeSuccess(data: PaystackEventData) {
  const reference = data.reference;

  if (!reference || typeof reference !== "string") {
    throw new Error("Successful Paystack event has no reference.");
  }

  const order = await db.order.findUnique({
    where: {
      paymentReference: reference,
    },
    include: {
      payment: true,
    },
  });

  if (!order || !order.payment) {
    throw new Error(
      `Order or payment not found for reference ${reference}.`
    );
  }

  if (order.payment.status === "SUCCESSFUL") {
    return;
  }

  if (order.payment.status !== "PENDING") {
    console.warn(
      `Ignoring successful event for non-pending payment ${reference}: ${order.payment.status}`
    );
    return;
  }

  if (
    !validateSuccessfulTransaction(
      data,
      order.payment,
      reference
    )
  ) {
    console.error(
      `Paystack transaction validation failed for order ${order.id}.`
    );

    throw new Error(
      "Paystack transaction details did not match the order."
    );
  }

  const result = await confirmSuccessfulPayment({
    reference,
    verifiedVia: "webhook",
    paystackResponse: JSON.parse(
      JSON.stringify(data)
    ) as Prisma.InputJsonValue,
  });

  if (result.claimed) {
    console.info(
      `Paystack success event processed for order ${result.orderId}.`
    );
  }
}

/**
 * Handle a failed charge.
 *
 * Inventory is restored only if this transaction successfully claims
 * a payment that is still pending. Repeated failure events cannot restore
 * the same inventory twice.
 */
async function handleChargeFailed(data: PaystackEventData) {
  const reference = data.reference;

  if (!reference || typeof reference !== "string") {
    throw new Error("Failed Paystack event has no reference.");
  }

  const order = await db.order.findUnique({
    where: { paymentReference: reference },
    include: {
      payment: true,
      items: true,
    },
  });

  if (!order || !order.payment) {
    throw new Error(`Order or payment not found for reference ${reference}.`);
  }

  if (
    order.payment.status !== "PENDING" ||
    order.status !== "PENDING"
  ) {
    // Do not release inventory for a payment already handled elsewhere.
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  // A signed webhook proves that Paystack sent the event, but checking
  // the current transaction state protects against conflicting events.
  let verificationResponse: Response;

  try {
    verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (error) {
    throw new Error(
      `Could not verify failed transaction ${reference} with Paystack: ${
        error instanceof Error ? error.message : "Unknown network error"
      }`
    );
  }

  if (!verificationResponse.ok) {
    throw new Error(
      `Paystack verification returned HTTP ${verificationResponse.status} for ${reference}.`
    );
  }

  let verificationResult: {
    status?: boolean;
    message?: string;
    data?: PaystackEventData;
  };

  try {
    verificationResult = await verificationResponse.json();
  } catch {
    throw new Error(
      `Paystack returned invalid verification JSON for ${reference}.`
    );
  }

  if (
    verificationResult.status !== true ||
    !verificationResult.data ||
    typeof verificationResult.data !== "object"
  ) {
    throw new Error(
      `Paystack could not verify the current state of transaction ${reference}.`
    );
  }

  const transaction = verificationResult.data;

  if (transaction.reference !== reference) {
    throw new Error(
      `Paystack verification reference mismatch for ${reference}.`
    );
  }

  // A success event may have been delivered after a failure event.
  // Always let the existing success handler perform its full validation
  // and use its established idempotent confirmation transaction.
  if (transaction.status === "success") {
    await handleChargeSuccess(transaction);
    return;
  }

  // Do not release reservations for pending, abandoned, or unknown states.
  if (transaction.status !== "failed") {
    throw new Error(
      `Paystack transaction ${reference} is not confirmed failed; current status: ${
        transaction.status ?? "unknown"
      }.`
    );
  }

  // Even a confirmed failure must match the order's expected amount/currency.
  if (
    typeof transaction.amount !== "number" ||
    !Number.isSafeInteger(transaction.amount) ||
    transaction.amount <= 0
  ) {
    throw new Error(
      `Paystack returned an invalid amount for failed transaction ${reference}.`
    );
  }

  if (
    typeof transaction.currency !== "string" ||
    transaction.currency.toUpperCase() !==
      order.payment.currency.toUpperCase()
  ) {
    throw new Error(
      `Paystack returned an unexpected currency for failed transaction ${reference}.`
    );
  }

  const expectedCents = Math.round(order.payment.amount.toNumber() * 100);

  if (transaction.amount !== expectedCents) {
    throw new Error(
      `Paystack returned an unexpected amount for failed transaction ${reference}.`
    );
  }

  await db.$transaction(async (tx) => {
    // Only one failure handler can claim the pending payment.
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
              : typeof data.gateway_response === "string"
                ? data.gateway_response
                : "Payment failed",
          verifiedVia: "webhook-and-api",
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
    }

    // Release the discount reservation made during checkout.
    // This happens only when this transaction successfully cancels the order.
    if (order.discountCodeId) {
      await tx.discountCode.updateMany({
        where: {
          id: order.discountCodeId,
          usedCount: { gt: 0 },
        },
        data: {
          usedCount: { decrement: 1 },
        },
      });
    }
  });

  console.info(
    `Paystack failure event verified and processed for order ${order.id}.`
  );
}
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");
    return jsonError("Webhook processing is unavailable.", 500);
  }

  const signature = req.headers.get("x-paystack-signature");

  if (!signature) {
    return jsonError("Missing signature.", 401);
  }

  try {
    const body = await req.text();

    if (!verifySignature(body, signature, secret)) {
      return jsonError("Invalid signature.", 401);
    }

    let event: {
      event?: string;
      data?: PaystackEventData;
    };

    try {
      event = JSON.parse(body);
    } catch {
      return jsonError("Invalid JSON payload.", 400);
    }
     if (
  !event ||
  typeof event.event !== "string" ||
  !event.data ||
  typeof event.data !== "object"
) {
  return jsonError("Invalid webhook payload.", 400);
}

const data = event.data as PaystackEventData;

switch (event.event) {
  case "charge.success":
    await handleChargeSuccess(data);
    break;

  case "charge.failed":
    await handleChargeFailed(data);
    break;

   case "refund.pending":
  case "refund.processing":
  case "refund.processed":
  case "refund.failed":
  case "refund.needs-attention": {
    const expectedStatus = event.event.slice("refund.".length);

    if (data.status?.toLowerCase() !== expectedStatus) {
      throw new Error("Paystack refund event/status mismatch.");
    }

    await finalizeRefundOperation(data);
    break;
  }

  default:
    return NextResponse.json({ received: true });
}

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);

    // A 5xx response allows Paystack to retry transient processing errors.
    return jsonError("Webhook processing failed.", 500);
  }
}