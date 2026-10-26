import { describe, expect, it } from "vitest";
import { calculateSellerBalance } from "@/lib/finance/accounting";

describe("calculateSellerBalance", () => {
  it("calculates sales, fees, discounts, refunds, and reversals", () => {
    const result = calculateSellerBalance(
      [
        { id: "r1", type: "SALE", amount: 100 },
        { id: "r2", type: "FEE", amount: -10 },
        { id: "r3", type: "DISCOUNT", amount: -5 },
        { id: "r4", type: "REFUND", amount: -20 },
        { id: "r5", type: "FEE_REVERSAL", amount: 2 },
        { id: "r6", type: "DISCOUNT_REVERSAL", amount: 1 },
      ],
      [],
    );

    expect(result).toEqual({
      earnedBalance: 68,
      paidOut: 0,
      reservedPayouts: 0,
      availableBalance: 68,
    });
  });

  it("deducts a verified payout ledger entry exactly once", () => {
    const result = calculateSellerBalance(
      [
        { id: "sale-1", type: "SALE", amount: 100 },
        { id: "fee-1", type: "FEE", amount: -10 },
        { id: "payout-1", type: "PAYOUT", amount: -30 },
      ],
      [
        { id: "payout-request-1", amount: 30, status: "PAID" },
      ],
    );

    expect(result.earnedBalance).toBe(90);
    expect(result.paidOut).toBe(30);
    expect(result.reservedPayouts).toBe(0);
    expect(result.availableBalance).toBe(60);
  });

  it("reserves pending, approved, and processing payouts", () => {
    const result = calculateSellerBalance(
      [{ id: "sale-1", type: "SALE", amount: 100 }],
      [
        { id: "p1", amount: 10, status: "PENDING" },
        { id: "p2", amount: 20, status: "APPROVED" },
        { id: "p3", amount: 15, status: "PROCESSING" },
      ],
    );

    expect(result.earnedBalance).toBe(100);
    expect(result.reservedPayouts).toBe(45);
    expect(result.availableBalance).toBe(55);
  });

  it("does not reserve rejected or failed payouts", () => {
    const result = calculateSellerBalance(
      [{ id: "sale-1", type: "SALE", amount: 100 }],
      [
        { id: "p1", amount: 20, status: "REJECTED" },
        { id: "p2", amount: 15, status: "FAILED" },
      ],
    );

    expect(result.reservedPayouts).toBe(0);
    expect(result.availableBalance).toBe(100);
  });

  it("preserves negative balances rather than hiding deficits", () => {
    const result = calculateSellerBalance(
      [
        { id: "sale-1", type: "SALE", amount: 10 },
        { id: "refund-1", type: "REFUND", amount: -25 },
      ],
      [],
    );

    expect(result.earnedBalance).toBe(-15);
    expect(result.availableBalance).toBe(-15);
  });

  it("rejects duplicate financial record IDs", () => {
    expect(() =>
      calculateSellerBalance(
        [
          { id: "duplicate", type: "SALE", amount: 100 },
          { id: "duplicate", type: "SALE", amount: 100 },
        ],
        [],
      ),
    ).toThrow(/duplicate financial record ID/i);
  });

  it("rejects invalid monetary precision", () => {
    expect(() =>
      calculateSellerBalance(
        [{ id: "sale-1", type: "SALE", amount: 10.123 }],
        [],
      ),
    ).toThrow(/two decimal places/i);
  });

  it("rejects positive payout ledger deductions", () => {
    expect(() =>
      calculateSellerBalance(
        [{ id: "payout-1", type: "PAYOUT", amount: 20 }],
        [],
      ),
    ).toThrow(/must be zero or negative/i);
  });
});

