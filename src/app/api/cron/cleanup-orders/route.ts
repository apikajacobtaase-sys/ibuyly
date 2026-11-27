 import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-successful-payment";
import { cancelExpiredPendingOrder } from "@/lib/payments/cancel-expired-pending-order";
import { deleteOldCancelledOrder } from "@/lib/payments/delete-old-cancelled-order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PaystackVerification = {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    gateway_response?: string;
  };
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: "Paystack configuration is missing." },
      { status: 500 }
    );
  }

  const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const errors: string[] = [];

const oldCancelledOrders = await db.order.findMany({
  where: {
    status: "CANCELLED",
    updatedAt: { lte: retentionCutoff },
  },
  select: { id: true },
 take: 3,
});

let deleted = 0;

for (const order of oldCancelledOrders) {
  try {
    if (await deleteOldCancelledOrder(order.id, retentionCutoff)) {
      deleted++;
    }
  } catch (error) {
    errors.push(
      `Deletion ${order.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

  const orders = await db.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: expiredBefore },
      paymentReference: { not: null },
      payment: {
        is: {
          provider: "PAYSTACK",
          status: "PENDING",
        },
      },
    },
    include: {
      payment: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 3,
  });

  let cancelled = 0;
  let recovered = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      if (!order.payment || !order.paymentReference) {
        skipped++;
        continue;
      }

      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(order.paymentReference)}`,
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

      if (!response.ok) {
        throw new Error(`Paystack HTTP ${response.status}`);
      }

      const result = (await response.json()) as PaystackVerification;

      if (result.status !== true || !result.data) {
        throw new Error("Paystack verification was inconclusive.");
      }

      const transaction = result.data;

      if (
        transaction.reference !== order.paymentReference ||
        typeof transaction.amount !== "number" ||
        !Number.isSafeInteger(transaction.amount) ||
        transaction.amount <= 0 ||
        transaction.amount !==
          Math.round(order.payment.amount.toNumber() * 100) ||
        typeof transaction.currency !== "string" ||
        transaction.currency.toUpperCase() !==
          order.payment.currency.toUpperCase()
      ) {
        throw new Error("Paystack transaction details did not match the order.");
      }

      if (transaction.status === "success") {
        await confirmSuccessfulPayment({
          reference: order.paymentReference,
          verifiedVia: "cron",
          paystackResponse: JSON.parse(
            JSON.stringify(transaction)
          ) as Prisma.InputJsonValue,
        });

        recovered++;
      } else if (transaction.status === "failed") {
        const wasCancelled = await cancelExpiredPendingOrder(
          order.id,
          expiredBefore,
          {
            reference: transaction.reference,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            gateway_response: transaction.gateway_response,
          }
        );

        if (wasCancelled) cancelled++;
        else skipped++;
      } else {
        // Pending, ongoing, abandoned or unknown states are left untouched.
        skipped++;
      }
    } catch (error) {
      errors.push(
        `${order.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return NextResponse.json({
    success: true,
    examined: orders.length,
    cancelled,
    recovered,
    skipped,
    errors,
    deletionCandidates: oldCancelledOrders.length,
deleted,
  });
}