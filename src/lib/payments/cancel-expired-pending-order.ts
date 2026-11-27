 import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type FailedPaystackTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  gateway_response?: string;
};

export async function cancelExpiredPendingOrder(
  orderId: string,
  expiredBefore: Date,
  transaction: FailedPaystackTransaction
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        items: true,
      },
    });

    if (
      !order ||
      order.status !== "PENDING" ||
      !order.payment ||
      order.payment.provider !== "PAYSTACK" ||
      order.payment.status !== "PENDING" ||
      order.createdAt > expiredBefore
    ) {
      return false;
    }

    const expectedCents = Math.round(order.payment.amount.toNumber() * 100);

    if (
      transaction.status !== "failed" ||
      transaction.reference !== order.paymentReference ||
      !Number.isSafeInteger(transaction.amount) ||
      transaction.amount <= 0 ||
      transaction.amount !== expectedCents ||
      transaction.currency.toUpperCase() !==
        order.payment.currency.toUpperCase()
    ) {
      throw new Error("Paystack failure verification did not match the order.");
    }

    const paymentClaim = await tx.payment.updateMany({
      where: {
        orderId,
        provider: "PAYSTACK",
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        metadata: {
          paystackResponse: JSON.parse(
            JSON.stringify(transaction)
          ) as Prisma.InputJsonValue,
          failureReason: transaction.gateway_response ?? "Payment failed",
          failedAt: new Date().toISOString(),
          verifiedVia: "cron",
          autoCancelledAt: new Date().toISOString(),
        },
      },
    });

    if (paymentClaim.count !== 1) return false;

    const cancelled = await tx.order.updateMany({
      where: {
        id: orderId,
        status: "PENDING",
        createdAt: { lte: expiredBefore },
      },
      data: {
        status: "CANCELLED",
      },
    });

    if (cancelled.count !== 1) {
      throw new Error(`Could not cancel expired order ${orderId}.`);
    }

    for (const item of order.items) {
      if (!item.offerId) {
        throw new Error(`Order item ${item.id} has no offerId.`);
      }

      const restored = await tx.sellerOffer.updateMany({
        where: {
          id: item.offerId,
          sellerId: item.sellerId ?? undefined,
        },
        data: {
          stockQuantity: { increment: item.quantity },
        },
      });

      if (restored.count !== 1) {
        throw new Error(`Could not restore inventory for ${item.id}.`);
      }

      if (item.flashDealId) {
        const released = await tx.flashDeal.updateMany({
          where: {
            id: item.flashDealId,
            reservedQuantity: { gte: item.quantity },
          },
          data: {
            reservedQuantity: { decrement: item.quantity },
          },
        });

        if (released.count !== 1) {
          throw new Error(`Could not release flash deal for ${item.id}.`);
        }
      }
    }

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

    return true;
  });
}