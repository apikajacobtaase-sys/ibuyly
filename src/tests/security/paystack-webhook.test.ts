 import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  confirmSuccessfulPayment: vi.fn(),
  finalizeRefundOperation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: mocks.orderFindUnique,
    },
  },
}));

vi.mock("@/lib/payments/confirm-successful-payment", () => ({
  confirmSuccessfulPayment: mocks.confirmSuccessfulPayment,
}));

vi.mock("@/lib/refunds/finalize-refund-operation", () => ({
  finalizeRefundOperation: mocks.finalizeRefundOperation,
}));

import { POST } from "@/app/api/webhooks/paystack/route";

const SECRET = "test-paystack-secret";

function createRequest(body: string, signature?: string) {
  return new Request("http://localhost/api/webhooks/paystack", {
    method: "POST",
    headers: signature
      ? { "x-paystack-signature": signature }
      : {},
    body,
  });
}

function sign(body: string) {
  return crypto
    .createHmac("sha512", SECRET)
    .update(body)
    .digest("hex");
}

function createEvent(event: string, data: Record<string, unknown>) {
  return JSON.stringify({ event, data });
}

describe("Paystack webhook security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = SECRET;

    mocks.confirmSuccessfulPayment.mockResolvedValue({
      claimed: true,
      orderId: "order-1",
    });

    mocks.finalizeRefundOperation.mockResolvedValue({
      matched: true,
      status: "SUCCEEDED",
    });
  });

  it("rejects requests when the secret is missing", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;

    const response = await POST(createRequest("{}"));

    expect(response.status).toBe(500);
  });

  it("rejects requests without a signature", async () => {
    const response = await POST(createRequest("{}"));

    expect(response.status).toBe(401);
  });

  it("rejects an invalid signature", async () => {
    const body = createEvent("refund.processed", {
      status: "processed",
    });

    const response = await POST(createRequest(body, "invalid"));

    expect(response.status).toBe(401);
    expect(mocks.finalizeRefundOperation).not.toHaveBeenCalled();
  });

  it("rejects a signature generated for a different request body", async () => {
    const body = createEvent("refund.processed", {
      status: "processed",
    });

    const wrongSignature = sign(body + "modified");

    const response = await POST(createRequest(body, wrongSignature));

    expect(response.status).toBe(401);
    expect(mocks.finalizeRefundOperation).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const body = "{invalid-json";

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(400);
  });

  it("rejects malformed webhook payloads", async () => {
    const body = JSON.stringify({
      event: "refund.processed",
      data: null,
    });

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(400);
  });

  it("acknowledges unknown event types without processing them", async () => {
    const body = createEvent("some.unknown.event", {});

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(200);
    expect(mocks.finalizeRefundOperation).not.toHaveBeenCalled();
    expect(mocks.confirmSuccessfulPayment).not.toHaveBeenCalled();
  });

  it("processes a correctly signed successful refund event", async () => {
    const data = {
      status: "processed",
      refund_reference: "IBUY-refund-1",
      transaction_reference: "PAY-REF-1",
      amount: "1000",
      currency: "GHS",
    };

    const body = createEvent("refund.processed", data);

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(200);
    expect(mocks.finalizeRefundOperation).toHaveBeenCalledWith(data);
  });

  it("accepts a pending refund event without a refund reference", async () => {
    const data = {
      status: "pending",
      refund_reference: null,
      amount: "1000",
      currency: "GHS",
    };

    const body = createEvent("refund.pending", data);

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(200);
    expect(mocks.finalizeRefundOperation).toHaveBeenCalledWith(data);
  });

  it("rejects refund event and payload status mismatches", async () => {
    const body = createEvent("refund.processed", {
      status: "pending",
      refund_reference: "IBUY-refund-1",
    });

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(500);
    expect(mocks.finalizeRefundOperation).not.toHaveBeenCalled();
  });

  it("returns 500 when refund finalization fails so Paystack can retry", async () => {
    mocks.finalizeRefundOperation.mockRejectedValue(
      new Error("Database unavailable")
    );

    const body = createEvent("refund.processed", {
      status: "processed",
      refund_reference: "IBUY-refund-1",
      transaction_reference: "PAY-REF-1",
      amount: "1000",
      currency: "GHS",
    });

    const response = await POST(createRequest(body, sign(body)));

    expect(response.status).toBe(500);
  });
});