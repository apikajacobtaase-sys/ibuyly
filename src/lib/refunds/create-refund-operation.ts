 import {
  Prisma,
  RefundInitiatorType,
  RefundOperationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  calculateItemRefund,
  calculateDeliveryFeeRefund,
  toCents,
} from "./calculations";

const RESERVED_STATUSES: RefundOperationStatus[] = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "REQUIRES_RECONCILIATION",
];

export type CreateRefundInput = {
  orderId: string;
  initiatedById?: string;
  initiatedByType: RefundInitiatorType;
  reason: string;
  idempotencyKey: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
  }>;
  includeDeliveryFee?: boolean;
};

type LedgerRecord = {
  type: string;
  amount: Prisma.Decimal;
  currency: string;
};

function cents(value: Prisma.Decimal): number {
  const amount = value.toNumber();
  const result = toCents(amount);

  if (Math.abs(amount * 100 - result) > 1e-7) {
    throw new Error("Financial value has more than two decimal places.");
  }

  return result;
}

function amount(centsValue: number): number {
  if (!Number.isSafeInteger(centsValue) || centsValue < 0) {
    throw new Error("Invalid financial allocation.");
  }

  return centsValue / 100;
}

function assertLedgerEntry(
  records: LedgerRecord[],
  type: string,
  expectedCents: number,
  currency: string
) {
  const matching = records.filter((record) => record.type === type);

  if (expectedCents === 0) {
    if (matching.length !== 0) {
      throw new Error(
        `Unexpected ${type} ledger entry. Reconciliation required.`
      );
    }

    return;
  }

  if (matching.length !== 1) {
    throw new Error(
      `Missing or duplicate ${type} ledger entry. Reconciliation required.`
    );
  }

  if (
    cents(matching[0].amount) !== expectedCents ||
    matching[0].currency.toUpperCase() !== currency
  ) {
    throw new Error(
      `${type} ledger does not match the original order. Reconciliation required.`
    );
  }
}

function assertSameRequest(
  existing: {
    orderId: string;
    reason: string;
    initiatedById: string | null;
    initiatedByType: RefundInitiatorType;
    items: Array<{
      orderItemId: string;
      refundedQuantity: number;
    }>;
    deliveryFeeAmount: Prisma.Decimal;
  },
  input: CreateRefundInput
) {
  const expectedItems = input.items
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
    }))
    .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));

  const existingItems = existing.items
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.refundedQuantity,
    }))
    .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));

  const sameItems =
    JSON.stringify(expectedItems) === JSON.stringify(existingItems);

  const requestedDelivery = Boolean(input.includeDeliveryFee);
  const existingDelivery = cents(existing.deliveryFeeAmount) > 0;

  if (
    existing.orderId !== input.orderId ||
    existing.reason !== input.reason.trim() ||
    existing.initiatedById !== (input.initiatedById ?? null) ||
    existing.initiatedByType !== input.initiatedByType ||
    !sameItems ||
    requestedDelivery !== existingDelivery
  ) {
    throw new Error(
      "Idempotency key was already used for a different refund request."
    );
  }
}

export async function createRefundOperationInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateRefundInput
) {
  const {
    orderId,
    initiatedById,
    initiatedByType,
    idempotencyKey,
  } = input;

  const reason = input.reason.trim();
  const includeDeliveryFee = Boolean(input.includeDeliveryFee);

  if (
    !orderId ||
    !reason ||
    reason.length > 500 ||
    !idempotencyKey ||
    idempotencyKey.length > 200
  ) {
    throw new Error("Invalid refund request.");
  }

  if (
    input.items.length === 0 &&
    !includeDeliveryFee
  ) {
    throw new Error(
      "A refund must contain at least one item or an authorized delivery-fee refund."
    );
  }

  const requestedItems = new Map<string, number>();

  for (const item of input.items) {
    if (
      !item.orderItemId ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      requestedItems.has(item.orderItemId)
    ) {
      throw new Error("Invalid or duplicate refund item.");
    }

    requestedItems.set(item.orderItemId, item.quantity);
  }

      // Serialize all refund reservations for this order.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM orders
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new Error("Order not found.");
      }

      // Enforce idempotency.
      const existing = await tx.refundOperation.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });

      if (existing) {
        assertSameRequest(existing, input);
        return existing;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
          discountCode: {
            include: { seller: true },
          },
          items: {
            include: {
              offer: {
                include: { seller: true },
              },
            },
          },
        },
      });

      if (!order?.payment) {
        throw new Error("Order or payment not found.");
      }

      const payment = order.payment;

      if (
        payment.status !== "SUCCESSFUL" ||
        payment.provider !== "PAYSTACK" ||
        !payment.providerTransactionId
      ) {
        throw new Error(
          "A successful Paystack payment with a transaction reference is required."
        );
      }

      const currency = payment.currency.toUpperCase();

      if (currency !== "GHS") {
        throw new Error("Unsupported refund currency.");
      }

      const paymentCents = cents(payment.amount);
      const orderTotalCents = cents(order.totalAmount);
      const deliveryFeeCents = cents(order.deliveryFee);
      const orderDiscountCents = cents(order.discountAmount);

      if (orderTotalCents !== paymentCents) {
        throw new Error(
          "Order total and successful payment do not reconcile."
        );
      }

      const orderItems = order.items;

      if (orderItems.length === 0) {
        throw new Error("Order contains no items.");
      }

      const grossOrderCents = orderItems.reduce((sum, item) => {
        if (
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          throw new Error("Invalid original order quantity.");
        }

        const gross = cents(item.price) * item.quantity;

        if (!Number.isSafeInteger(gross)) {
          throw new Error("Original item amount exceeds safe limits.");
        }

        return sum + gross;
      }, 0);

      const snapshotDiscountCents = orderItems.reduce(
        (sum, item) => sum + cents(item.discountAmount),
        0
      );

      if (snapshotDiscountCents !== orderDiscountCents) {
        throw new Error(
          "Item discount snapshots do not match the order discount. Reconciliation required."
        );
      }

      if (
        grossOrderCents -
          orderDiscountCents +
          deliveryFeeCents !==
        paymentCents
      ) {
        throw new Error(
          "Order merchandise, discount and delivery totals do not reconcile."
        );
      }

      if (orderDiscountCents > 0) {
        if (
          !order.discountCode ||
          order.discountCode.sellerId.length === 0
        ) {
          throw new Error(
            "Discount funding ownership cannot be established."
          );
        }

        for (const item of orderItems) {
          if (
            cents(item.discountAmount) > 0 &&
            item.sellerId !== order.discountCode.sellerId
          ) {
            throw new Error(
              "Discount is attributed to the wrong seller. Reconciliation required."
            );
          }
        }
      }

      const selectedItems = orderItems.filter((item) =>
        requestedItems.has(item.id)
      );

      if (selectedItems.length !== requestedItems.size) {
        throw new Error(
          "One or more requested items do not belong to this order."
        );
      }

      // Validate seller, offer and variant ownership.
      for (const item of orderItems) {
        if (
          !item.sellerId ||
          !item.offerId ||
          !item.offer ||
          item.offer.sellerId !== item.sellerId ||
          item.offer.variantId !== item.variantId ||
          item.offer.seller.id !== item.sellerId
        ) {
          throw new Error(
            `Seller ownership or offer relationship is invalid for item ${item.id}.`
          );
        }

        const itemGrossCents = cents(item.price) * item.quantity;
        const itemDiscountCents = cents(item.discountAmount);
        const itemCommissionCents = cents(item.commissionAmount);

        if (
          itemGrossCents <= 0 ||
          itemDiscountCents < 0 ||
          itemDiscountCents > itemGrossCents ||
          itemCommissionCents < 0 ||
          itemCommissionCents >
            itemGrossCents - itemDiscountCents
        ) {
          throw new Error(
            `Invalid financial snapshots for item ${item.id}.`
          );
        }
      }

      // Load all reservations that still consume refund capacity.
      const previousOperations = await tx.refundOperation.findMany({
        where: {
          orderId,
          status: { in: RESERVED_STATUSES },
        },
        include: { items: true },
      });

      const reservedByItem = new Map<
        string,
        {
          quantity: number;
          discountCents: number;
          commissionCents: number;
        }
      >();

      let previouslyReservedAmount = 0;
      let previouslyReservedDelivery = 0;

      for (const operation of previousOperations) {
        previouslyReservedAmount += cents(operation.amount);
        previouslyReservedDelivery += cents(
          operation.deliveryFeeAmount
        );

        for (const operationItem of operation.items) {
          const previous = reservedByItem.get(
            operationItem.orderItemId
          ) ?? {
            quantity: 0,
            discountCents: 0,
            commissionCents: 0,
          };

          previous.quantity += operationItem.refundedQuantity;
          previous.discountCents += cents(
            operationItem.discountAmount
          );
          previous.commissionCents += cents(
            operationItem.commissionReversal
          );

          reservedByItem.set(operationItem.orderItemId, previous);
        }
      }

      const operationItems = [];
      let merchandiseRefundCents = 0;

      for (const item of selectedItems) {
        const previous = reservedByItem.get(item.id) ?? {
          quantity: 0,
          discountCents: 0,
          commissionCents: 0,
        };

        const result = calculateItemRefund({
          unitPrice: item.price.toNumber(),
          totalQuantity: item.quantity,
          requestedQuantity: requestedItems.get(item.id)!,
          discountAmount: item.discountAmount.toNumber(),
          commissionAmount: item.commissionAmount.toNumber(),
          previouslyReservedQuantity: previous.quantity,
          previouslyReservedDiscountCents: previous.discountCents,
          previouslyReservedCommissionCents:
            previous.commissionCents,
        });

        operationItems.push({
          orderItemId: item.id,
          refundedQuantity: result.refundedQuantity,
          grossAmount: amount(result.grossAmountCents),
          discountAmount: amount(result.discountAmountCents),
          commissionReversal: amount(
            result.commissionReversalCents
          ),
          refundAmount: amount(result.refundAmountCents),
        });

        merchandiseRefundCents += result.refundAmountCents;
      }

      // Validate original seller ledger entries.
      const sellerIds = [
        ...new Set(orderItems.map((item) => item.sellerId!)),
      ];

      const ledger = await tx.sellerFinancialRecord.findMany({
        where: {
          orderId,
          sellerId: { in: sellerIds },
          type: { in: ["SALE", "DISCOUNT", "FEE"] },
        },
      });

      for (const sellerId of sellerIds) {
        const sellerItems = orderItems.filter(
          (item) => item.sellerId === sellerId
        );

        const records = ledger.filter(
          (record) => record.sellerId === sellerId
        );

        const grossCents = sellerItems.reduce(
          (sum, item) => sum + cents(item.price) * item.quantity,
          0
        );

        const discountCents = sellerItems.reduce(
          (sum, item) => sum + cents(item.discountAmount),
          0
        );

        const commissionCents = sellerItems.reduce(
          (sum, item) => sum + cents(item.commissionAmount),
          0
        );

        assertLedgerEntry(records, "SALE", grossCents, currency);
        assertLedgerEntry(
          records,
          "DISCOUNT",
          -discountCents,
          currency
        );
        assertLedgerEntry(
          records,
          "FEE",
          -commissionCents,
          currency
        );
      }

      // Delivery fee requires explicit authorization and
      // every order item must be cancelled and fully accounted for.
      let deliveryRefundCents = 0;

      if (includeDeliveryFee) {
        const entireOrderCancelled = orderItems.every((item) => {
          const previous = reservedByItem.get(item.id);
          const newlyRequested = requestedItems.get(item.id) ?? 0;

          return (
            item.status === "CANCELLED" &&
            (previous?.quantity ?? 0) + newlyRequested ===
              item.quantity
          );
        });

        if (!entireOrderCancelled) {
          throw new Error(
            "Delivery fee can only be refunded after every order item is cancelled and fully accounted for."
          );
        }

        if (previouslyReservedDelivery > 0) {
          throw new Error(
            "Delivery fee has already been reserved or refunded."
          );
        }

        deliveryRefundCents = calculateDeliveryFeeRefund(
          order.deliveryFee.toNumber(),
          true
        );
      }

      const totalRefundCents =
        merchandiseRefundCents + deliveryRefundCents;

      if (totalRefundCents <= 0) {
        throw new Error("Refund amount must be greater than zero.");
      }

      if (
        previouslyReservedAmount + totalRefundCents >
        paymentCents
      ) {
        throw new Error(
          "Refund reservations would exceed the original payment."
        );
      }

      return tx.refundOperation.create({
        data: {
          orderId,
          paymentId: payment.id,
          initiatedById,
          initiatedByType,
          reason,
          amount: amount(totalRefundCents),
          merchandiseAmount: amount(merchandiseRefundCents),
          deliveryFeeAmount: amount(deliveryRefundCents),
          currency,
          provider: payment.provider,
          status: "PENDING",
          idempotencyKey,
          items: {
            create: operationItems,
          },
        },
        include: {
          items: true,
        },
      });
}

export async function createRefundOperation(input: CreateRefundInput) {
  return db.$transaction(
    (tx) => createRefundOperationInTransaction(tx, input),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    }
  );
}