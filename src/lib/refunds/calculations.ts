 export type RefundItemInput = {
  unitPrice: number;
  totalQuantity: number;
  requestedQuantity: number;

  discountAmount: number;
  commissionAmount: number;

  previouslyReservedQuantity: number;
  previouslyReservedDiscountCents: number;
  previouslyReservedCommissionCents: number;
};

export type RefundItemCalculation = {
  refundedQuantity: number;
  grossAmountCents: number;
  discountAmountCents: number;
  commissionReversalCents: number;
  refundAmountCents: number;
};

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid monetary amount.");
  }

  const cents = Math.round(amount * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Monetary amount exceeds the safe limit.");
  }

  return cents;
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Invalid monetary value.");
  }

  return cents / 100;
}

/**
 * Calculates the cumulative proportional allocation of a snapshot.
 *
 * Subtracting the previous allocation ensures that rounding
 * differences are distributed across successive partial refunds.
 */
function cumulativeAllocation(
  totalCents: number,
  totalQuantity: number,
  previousQuantity: number,
  requestedQuantity: number,
  previouslyAllocatedCents: number
): number {
  const cumulativeQuantity =
    previousQuantity + requestedQuantity;

  const numerator =
    BigInt(totalCents) * BigInt(cumulativeQuantity);

  const denominator = BigInt(totalQuantity);

  // Integer division with half-up rounding.
  const cumulativeAmount = Number(
    (numerator + denominator / BigInt(2)) / denominator
  );

  const allocation =
    cumulativeAmount - previouslyAllocatedCents;

  if (
    !Number.isSafeInteger(allocation) ||
    allocation < 0 ||
    allocation > totalCents - previouslyAllocatedCents
  ) {
    throw new Error("Invalid cumulative refund allocation.");
  }

  return allocation;
}

/**
 * Calculate the financial impact of refunding an order item.
 *
 * All snapshot amounts are original line-level amounts,
 * not per-unit amounts.
 */
export function calculateItemRefund(
  input: RefundItemInput
): RefundItemCalculation {
  const {
    unitPrice,
    totalQuantity,
    requestedQuantity,
    discountAmount,
    commissionAmount,
    previouslyReservedQuantity,
    previouslyReservedDiscountCents,
    previouslyReservedCommissionCents,
  } = input;

  if (
    !Number.isSafeInteger(totalQuantity) ||
    totalQuantity <= 0 ||
    !Number.isSafeInteger(requestedQuantity) ||
    requestedQuantity <= 0
  ) {
    throw new Error("Invalid refund quantity.");
  }

  if (
    !Number.isSafeInteger(previouslyReservedQuantity) ||
    previouslyReservedQuantity < 0 ||
    previouslyReservedQuantity + requestedQuantity >
      totalQuantity
  ) {
    throw new Error(
      "Requested refund exceeds the remaining refundable quantity."
    );
  }

  const unitPriceCents = toCents(unitPrice);
  const totalDiscountCents = toCents(discountAmount);
  const totalCommissionCents = toCents(commissionAmount);

  if (
    unitPriceCents <= 0 ||
    totalDiscountCents < 0 ||
    totalCommissionCents < 0
  ) {
    throw new Error("Invalid original financial snapshots.");
  }

  const originalGrossCents =
    unitPriceCents * totalQuantity;

  if (
    !Number.isSafeInteger(originalGrossCents) ||
    totalDiscountCents > originalGrossCents
  ) {
    throw new Error("Invalid original item totals.");
  }

  if (
    previouslyReservedDiscountCents < 0 ||
    previouslyReservedCommissionCents < 0 ||
    previouslyReservedDiscountCents > totalDiscountCents ||
    previouslyReservedCommissionCents > totalCommissionCents
  ) {
    throw new Error("Invalid previously reserved allocations.");
  }

  const grossAmountCents =
    unitPriceCents * requestedQuantity;

  const discountAmountCents = cumulativeAllocation(
    totalDiscountCents,
    totalQuantity,
    previouslyReservedQuantity,
    requestedQuantity,
    previouslyReservedDiscountCents
  );

  const commissionReversalCents = cumulativeAllocation(
    totalCommissionCents,
    totalQuantity,
    previouslyReservedQuantity,
    requestedQuantity,
    previouslyReservedCommissionCents
  );

  const refundAmountCents =
    grossAmountCents - discountAmountCents;

  if (
    refundAmountCents <= 0 ||
    !Number.isSafeInteger(refundAmountCents)
  ) {
    throw new Error("Calculated refund amount is invalid.");
  }

  return {
    refundedQuantity: requestedQuantity,
    grossAmountCents,
    discountAmountCents,
    commissionReversalCents,
    refundAmountCents,
  };
}

/**
 * Delivery fees are refundable only when the entire order
 * qualifies for cancellation.
 */
export function calculateDeliveryFeeRefund(
  deliveryFee: number,
  entireOrderCancelled: boolean
): number {
  if (!entireOrderCancelled) {
    return 0;
  }

  const deliveryFeeCents = toCents(deliveryFee);

  if (deliveryFeeCents < 0) {
    throw new Error("Invalid delivery fee.");
  }

  return deliveryFeeCents;
}