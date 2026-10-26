export type FinancialRecordType =
  | "SALE"
  | "FEE"
  | "DISCOUNT"
  | "REFUND"
  | "FEE_REVERSAL"
  | "DISCOUNT_REVERSAL"
  | "ADJUSTMENT"
  | "PAYOUT";

export type PayoutStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "FAILED";

export interface FinancialRecord {
  id: string;
  type: FinancialRecordType;
  amount: number;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  status: PayoutStatus;
}

export interface SellerBalance {
  earnedBalance: number;
  paidOut: number;
  reservedPayouts: number;
  availableBalance: number;
}

const EARNING_RECORD_TYPES = new Set<FinancialRecordType>([
  "SALE",
  "FEE",
  "DISCOUNT",
  "REFUND",
  "FEE_REVERSAL",
  "DISCOUNT_REVERSAL",
  "ADJUSTMENT",
]);

const RESERVED_PAYOUT_STATUSES = new Set<PayoutStatus>([
  "PENDING",
  "APPROVED",
  "PROCESSING",
]);

function validateAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} must be a finite number.`);
  }

  // Accounting amounts must use two-decimal precision.
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new Error(`${label} must not have more than two decimal places.`);
  }
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

/**
 * Computes a seller's balance using financial ledger entries as the
 * authoritative record of earnings and paid-out deductions.
 *
 * Ledger convention:
 * - SALE and reversals that increase earnings: positive amounts.
 * - FEE, DISCOUNT, REFUND, and other deductions: negative amounts.
 * - PAYOUT: negative amount, posted exactly once after a transfer is verified.
 *
 * PAID payout records are not deducted a second time here. Their corresponding
 * PAYOUT ledger entries must already exist.
 *
 * Pending, approved, and processing payouts reserve funds but do not change
 * earned balance. Rejected or failed payouts do not reserve funds.
 *
 * This function deliberately does not clamp negative balances to zero.
 */
export function calculateSellerBalance(
  records: FinancialRecord[],
  payouts: PayoutRecord[],
): SellerBalance {
  const recordIds = new Set<string>();
  const payoutIds = new Set<string>();

  let earnedCents = 0;
  let paidOutCents = 0;
  let reservedCents = 0;

  for (const record of records) {
    if (!record.id || recordIds.has(record.id)) {
      throw new Error(`Missing or duplicate financial record ID: ${record.id}`);
    }

    recordIds.add(record.id);
    validateAmount(record.amount, `Financial record ${record.id} amount`);

    if (record.type === "PAYOUT") {
      if (record.amount > 0) {
        throw new Error(`PAYOUT record ${record.id} must be zero or negative.`);
      }

      paidOutCents += -toCents(record.amount);
      continue;
    }

    if (!EARNING_RECORD_TYPES.has(record.type)) {
      throw new Error(`Unsupported financial record type: ${record.type}`);
    }

    earnedCents += toCents(record.amount);
  }

  for (const payout of payouts) {
    if (!payout.id || payoutIds.has(payout.id)) {
      throw new Error(`Missing or duplicate payout ID: ${payout.id}`);
    }

    payoutIds.add(payout.id);
    validateAmount(payout.amount, `Payout ${payout.id} amount`);

    if (payout.amount <= 0) {
      throw new Error(`Payout ${payout.id} amount must be positive.`);
    }

    if (RESERVED_PAYOUT_STATUSES.has(payout.status)) {
      reservedCents += toCents(payout.amount);
    }
  }

  const availableCents = earnedCents - paidOutCents - reservedCents;

  return {
    earnedBalance: fromCents(earnedCents),
    paidOut: fromCents(paidOutCents),
    reservedPayouts: fromCents(reservedCents),
    availableBalance: fromCents(availableCents),
  };
}

