 import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type RefundEvent = {
  status?: string;
  refund_reference?: string | null;
  transaction_reference?: string;
  amount?: string | number;
  currency?: string;
  [key: string]: unknown;
};

function toCents(value: Prisma.Decimal): number {
  const amount = value.toNumber();
  const cents = Math.round(amount * 100);

  if (
    !Number.isFinite(amount) ||
    Math.abs(amount * 100 - cents) > 1e-7
  ) {
    throw new Error("Invalid monetary amount.");
  }

  return cents;
}

function eventAmountToCents(value: string | number | undefined) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Invalid Paystack refund amount.");
  }

  return amount;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function finalizeRefundOperation(event: RefundEvent) {
  const reference = event.refund_reference;

  // Some early pending events do not contain a refund reference.
  // They cannot safely identify one of several partial refunds.
  if (!reference) {
    return {
      matched: false,
      reason: "Refund reference not supplied.",
    };
  }

  const operation = await db.refundOperation.findFirst({
    where: {
      provider: "PAYSTACK",
      providerReference: reference,
    },
    include: {
      payment: true,
      order: true,
      items: {
        include: {
          orderItem: {
            select: {
              sellerId: true,
            },
          },
        },
      },
    },
  });

  if (!operation) {
    return {
      matched: false,
      reason: "Refund operation not found.",
    };
  }

  const status = event.status?.toLowerCase();

  if (
    !["pending", "processing", "processed", "failed", "needs-attention"].includes(
      status ?? ""
    )
  ) {
    throw new Error("Unsupported Paystack refund status.");
  }

  const transactionReference = event.transaction_reference;

  if (
    !transactionReference ||
    (
      transactionReference !== operation.order.paymentReference &&
      transactionReference !== operation.payment.providerTransactionId
    )
  ) {
    throw new Error("Paystack transaction reference mismatch.");
  }

  if (
    typeof event.currency !== "string" ||
    event.currency.toUpperCase() !== operation.currency.toUpperCase()
  ) {
    throw new Error("Paystack refund currency mismatch.");
  }

  const eventAmountCents = eventAmountToCents(event.amount);

  if (eventAmountCents !== toCents(operation.amount)) {
    throw new Error("Paystack refund amount mismatch.");
  }

  return db.$transaction(
    async (tx) => {
      // Serialize refund finalization for this order.
      await tx.$queryRaw`
        SELECT id FROM orders
        WHERE id = ${operation.orderId}
        FOR UPDATE
      `;

      const locked = await tx.refundOperation.findUnique({
        where: { id: operation.id },
        include: {
          payment: true,
          items: {
            include: {
              orderItem: {
                select: { sellerId: true },
              },
            },
          },
        },
      });

      if (!locked) {
        throw new Error("Refund operation disappeared.");
      }

      if (locked.status === "SUCCEEDED") {
        return {
          matched: true,
          status: "SUCCEEDED",
          alreadyFinalized: true,
        };
      }

      if (
        locked.status !== "PROCESSING" &&
        locked.status !== "REQUIRES_RECONCILIATION"
      ) {
        throw new Error(
          `Cannot finalize refund from status ${locked.status}.`
        );
      }

      const providerResponse = toJson(event);

      // Intermediate provider states do not create accounting entries.
      if (status === "pending" || status === "processing") {
        await tx.refundOperation.update({
          where: { id: locked.id },
          data: {
            status: "PROCESSING",
            providerResponse,
          },
        });

        return {
          matched: true,
          status: "PROCESSING",
        };
      }

      if (status === "needs-attention") {
        await tx.refundOperation.update({
          where: { id: locked.id },
          data: {
            status: "REQUIRES_RECONCILIATION",
            providerResponse,
          },
        });

        return {
          matched: true,
          status: "REQUIRES_RECONCILIATION",
        };
      }

      if (status === "failed") {
        await tx.refundOperation.update({
          where: { id: locked.id },
          data: {
            status: "FAILED",
            providerResponse,
          },
        });

        return {
          matched: true,
          status: "FAILED",
        };
      }

      // Only refund.processed reaches this point.
      const existingRecords = await tx.sellerFinancialRecord.findMany({
        where: {
          refundOperationId: locked.id,
        },
      });

      // Our accounting records and operation status are committed in
      // one transaction. Existing records here indicate an anomaly.
      if (existingRecords.length > 0) {
        throw new Error(
          "Refund accounting records already exist. Manual reconciliation required."
        );
      }

      const sellerTotals = new Map<
        string,
        {
          grossCents: number;
          discountCents: number;
          commissionCents: number;
        }
      >();

      for (const item of locked.items) {
        const sellerId = item.orderItem.sellerId;

        if (!sellerId) {
          throw new Error(
            `Refund item ${item.orderItemId} has no seller.`
          );
        }

        const totals = sellerTotals.get(sellerId) ?? {
          grossCents: 0,
          discountCents: 0,
          commissionCents: 0,
        };

        totals.grossCents += toCents(item.grossAmount);
        totals.discountCents += toCents(item.discountAmount);
        totals.commissionCents += toCents(
          item.commissionReversal
        );

        sellerTotals.set(sellerId, totals);
      }

      for (const [sellerId, totals] of sellerTotals) {
        const description =
          `Refund for order #${locked.orderId.slice(-8).toUpperCase()}`;

        // Reverse original gross merchandise sale.
        if (totals.grossCents > 0) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: locked.orderId,
              refundOperationId: locked.id,
              type: "REFUND",
              amount: -(totals.grossCents / 100),
              currency: locked.currency,
              description,
            },
          });
        }

        // Restore the seller-funded discount.
        if (totals.discountCents > 0) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: locked.orderId,
              refundOperationId: locked.id,
              type: "DISCOUNT_REVERSAL",
              amount: totals.discountCents / 100,
              currency: locked.currency,
              description: `${description} - Discount reversal`,
            },
          });
        }

        // Reverse platform commission.
        if (totals.commissionCents > 0) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: locked.orderId,
              refundOperationId: locked.id,
              type: "FEE_REVERSAL",
              amount: totals.commissionCents / 100,
              currency: locked.currency,
              description: `${description} - Commission reversal`,
            },
          });
        }
      }

      await tx.refundOperation.update({
        where: { id: locked.id },
        data: {
          status: "SUCCEEDED",
          providerResponse,
          completedAt: new Date(),
        },
      });

      // Recalculate cumulative successful refunds.
      const successfulOperations = await tx.refundOperation.findMany({
        where: {
          paymentId: locked.paymentId,
          status: "SUCCEEDED",
        },
        select: {
          amount: true,
        },
      });

      const totalRefundedCents = successfulOperations.reduce(
        (sum, item) => sum + toCents(item.amount),
        0
      );

      const originalPaymentCents = toCents(locked.payment.amount);

      if (totalRefundedCents > originalPaymentCents) {
        throw new Error(
          "Successful refunds exceed the original payment. Reconciliation required."
        );
      }
      await tx.auditLog.create({
  data: {
    userId: locked.initiatedById,
    action: "REFUND_OPERATION_SUCCEEDED",
    resourceType: "RefundOperation",
    resourceId: locked.id,
    metadata: {
      orderId: locked.orderId,
      paymentId: locked.paymentId,
      amount: locked.amount.toNumber(),
      currency: locked.currency,
      provider: locked.provider,
      providerReference: locked.providerReference,
    } as Prisma.InputJsonValue,
  },
});
      // Only a fully refunded payment becomes REFUNDED.
      if (totalRefundedCents === originalPaymentCents) {
        await tx.payment.update({
          where: { id: locked.paymentId },
          data: { status: "REFUNDED" },
        });

        await tx.order.update({
          where: { id: locked.orderId },
          data: { status: "REFUNDED" },
        });

        await tx.auditLog.create({
  data: {
    userId: locked.initiatedById,
    action: "ORDER_REFUNDED",
    resourceType: "Order",
    resourceId: locked.orderId,
    metadata: {
      paymentId: locked.paymentId,
      totalRefunded: totalRefundedCents / 100,
      originalPayment: originalPaymentCents / 100,
      currency: locked.currency,
      provider: locked.provider,
    } as Prisma.InputJsonValue,
  },
});
      }

      return {
        matched: true,
        status: "SUCCEEDED",
        totalRefundedCents,
        originalPaymentCents,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );
}