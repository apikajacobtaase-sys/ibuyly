 import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  transaction: vi.fn(),
  returnUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
  findUnique: vi.fn(),
  operationUpdate: vi.fn(),
  sellerRecordsFindMany: vi.fn(),
  sellerRecordCreate: vi.fn(),
  operationFindMany: vi.fn(),
  auditCreate: vi.fn(),
  paymentUpdate: vi.fn(),
  orderUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    refundOperation: {
      findFirst: mocks.findFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import { finalizeRefundOperation } from "@/lib/refunds/finalize-refund-operation";

const tx = {
  $queryRaw: mocks.queryRaw,
  refundOperation: {
    findUnique: mocks.findUnique,
    update: mocks.operationUpdate,
    findMany: mocks.operationFindMany,
  },
  sellerFinancialRecord: {
    findMany: mocks.sellerRecordsFindMany,
    create: mocks.sellerRecordCreate,
  },
  auditLog: {
    create: mocks.auditCreate,
  },
  payment: {
    update: mocks.paymentUpdate,
  },
  order: {
    update: mocks.orderUpdate,
  },
  return: {
  updateMany: mocks.returnUpdateMany,
},
};

function makeOperation(paymentAmount = "100.00") {
  return {
    id: "refund-1",
    provider: "PAYSTACK",
    providerReference: "IBUY-refund-1",
    orderId: "order-12345678",
    paymentId: "payment-1",
    initiatedById: "admin-1",
    amount: new Prisma.Decimal("10.00"),
    currency: "GHS",
    status: "PROCESSING",
    order: {
      paymentReference: "PAY-REF-1",
    },
    payment: {
      id: "payment-1",
      providerTransactionId: "PAY-REF-1",
      amount: new Prisma.Decimal(paymentAmount),
    },
    items: [
      {
        orderItemId: "item-1",
        grossAmount: new Prisma.Decimal("10.00"),
        discountAmount: new Prisma.Decimal("1.00"),
        commissionReversal: new Prisma.Decimal("0.90"),
        orderItem: {
          sellerId: "seller-1",
        },
      },
    ],
  };
}

function makeEvent(status = "processed") {
  return {
    status,
    refund_reference: "IBUY-refund-1",
    transaction_reference: "PAY-REF-1",
    amount: 1000,
    currency: "GHS",
  };
}

describe("Refund finalization", () => {
  beforeEach(() => {
    mocks.returnUpdateMany.mockResolvedValue({ count: 0 });
    vi.clearAllMocks();
     
    const operation = makeOperation();

    mocks.findFirst.mockResolvedValue(operation);
    mocks.findUnique.mockResolvedValue(operation);

    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    );

    mocks.sellerRecordsFindMany.mockResolvedValue([]);
    mocks.sellerRecordCreate.mockResolvedValue({});
    mocks.operationUpdate.mockResolvedValue({});
    mocks.operationFindMany.mockResolvedValue([
      { amount: new Prisma.Decimal("10.00") },
    ]);
    mocks.auditCreate.mockResolvedValue({});
    mocks.paymentUpdate.mockResolvedValue({});
    mocks.orderUpdate.mockResolvedValue({});
  });

  it("rejects events without a refund reference", async () => {
    const result = await finalizeRefundOperation({
      status: "processed",
    });

    expect(result.matched).toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns unmatched when the refund operation does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await finalizeRefundOperation(
      makeEvent()
    );

    expect(result.matched).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an incorrect refund amount", async () => {
    await expect(
      finalizeRefundOperation({
        ...makeEvent(),
        amount: 500,
      })
    ).rejects.toThrow("Paystack refund amount mismatch.");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a mismatched transaction reference", async () => {
    await expect(
      finalizeRefundOperation({
        ...makeEvent(),
        transaction_reference: "WRONG-REFERENCE",
      })
    ).rejects.toThrow("Paystack transaction reference mismatch.");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates the correct seller accounting records for a successful refund", async () => {
    const result = await finalizeRefundOperation(makeEvent());

    expect(result).toMatchObject({
      matched: true,
      status: "SUCCEEDED",
      totalRefundedCents: 1000,
      originalPaymentCents: 10000,
    });

    expect(mocks.sellerRecordCreate).toHaveBeenCalledTimes(3);

    const records = mocks.sellerRecordCreate.mock.calls.map(
      ([call]) => call.data
    );

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sellerId: "seller-1",
          type: "REFUND",
          amount: -10,
        }),
        expect.objectContaining({
          sellerId: "seller-1",
          type: "DISCOUNT_REVERSAL",
          amount: 1,
        }),
        expect.objectContaining({
          sellerId: "seller-1",
          type: "FEE_REVERSAL",
          amount: 0.9,
        }),
      ])
    );

    expect(mocks.operationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCEEDED",
        }),
      })
    );

    expect(mocks.paymentUpdate).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("marks the payment and order refunded when the full payment is refunded", async () => {
    const operation = makeOperation("10.00");

    mocks.findFirst.mockResolvedValue(operation);
    mocks.findUnique.mockResolvedValue(operation);

    mocks.operationFindMany.mockResolvedValue([
      { amount: new Prisma.Decimal("10.00") },
    ]);

    await finalizeRefundOperation(makeEvent());

    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: "REFUNDED" },
    });

    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-12345678" },
      data: { status: "REFUNDED" },
    });
  });

  it("does not duplicate accounting records for an already finalized refund", async () => {
    mocks.findUnique.mockResolvedValue({
      ...makeOperation(),
      status: "SUCCEEDED",
    });

    const result = await finalizeRefundOperation(makeEvent());

    expect(result).toMatchObject({
      matched: true,
      status: "SUCCEEDED",
      alreadyFinalized: true,
    });

    expect(mocks.sellerRecordCreate).not.toHaveBeenCalled();
    expect(mocks.operationUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "PROCESSING"],
    ["processing", "PROCESSING"],
    ["needs-attention", "REQUIRES_RECONCILIATION"],
    ["failed", "FAILED"],
  ])("does not create accounting records for %s refunds", async (status, expectedStatus) => {
    const result = await finalizeRefundOperation(makeEvent(status));

    expect(result).toMatchObject({
      matched: true,
      status: expectedStatus,
    });

    expect(mocks.sellerRecordCreate).not.toHaveBeenCalled();
    expect(mocks.operationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: expectedStatus,
        }),
      })
    );
  });
});