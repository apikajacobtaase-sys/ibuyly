 import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type PaystackRefundResponse = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number;
    status?: string;
    reference?: string;
    [key: string]: unknown;
  };
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function executeRefundOperation(operationId: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const operation = await db.refundOperation.findUnique({
    where: { id: operationId },
    include: {
      payment: true,
      order: true,
    },
  });

  if (!operation) {
    throw new Error("Refund operation not found.");
  }

  if (operation.status === "SUCCEEDED") {
    return { success: true, status: "SUCCEEDED", alreadyCompleted: true };
  }

  if (operation.status !== "PENDING") {
    throw new Error(
      `Refund operation cannot be submitted from status ${operation.status}.`
    );
  }

  if (
    operation.provider !== "PAYSTACK" ||
    operation.payment.provider !== "PAYSTACK" ||
    !operation.payment.providerTransactionId
  ) {
    throw new Error("A valid Paystack payment is required.");
  }

  if (
    operation.payment.status !== "SUCCESSFUL" ||
    operation.payment.orderId !== operation.orderId
  ) {
    throw new Error("The original payment is not eligible for refund.");
  }

  const amountKobo = Math.round(operation.amount.toNumber() * 100);

  if (
    !Number.isSafeInteger(amountKobo) ||
    amountKobo <= 0 ||
    Math.abs(operation.amount.toNumber() * 100 - amountKobo) > 1e-7
  ) {
    throw new Error("Invalid refund amount.");
  }

  // Stable reference: retries and webhook reconciliation use the same value.
  const providerReference = `IBUY-${operation.id}`;

  // Only one request can claim this operation.
  const claim = await db.refundOperation.updateMany({
    where: {
      id: operationId,
      status: "PENDING",
      providerReference: null,
    },
    data: {
      status: "PROCESSING",
      providerReference,
    },
  });

  if (claim.count !== 1) {
    const current = await db.refundOperation.findUnique({
      where: { id: operationId },
      select: { status: true },
    });

    if (current?.status === "SUCCEEDED") {
      return {
        success: true,
        status: "SUCCEEDED",
        alreadyCompleted: true,
      };
    }

    throw new Error(
      `Refund operation was already claimed or changed status: ${current?.status ?? "unknown"}.`
    );
  }

  let response: Response;

  try {
    response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: operation.payment.providerTransactionId,
        amount: amountKobo,
        reference: providerReference,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    await db.refundOperation.updateMany({
      where: {
        id: operationId,
        status: "PROCESSING",
      },
      data: {
        status: "REQUIRES_RECONCILIATION",
        providerResponse: toJson({
          error: errorMessage(error),
          outcome: "UNKNOWN",
          reference: providerReference,
        }),
      },
    });

    throw new Error(
      "Paystack refund outcome is unknown. Reconcile using the saved refund reference; do not resubmit."
    );
  }

  let result: PaystackRefundResponse;

  try {
    result = (await response.json()) as PaystackRefundResponse;
  } catch {
    await db.refundOperation.updateMany({
      where: {
        id: operationId,
        status: "PROCESSING",
      },
      data: {
        status: "REQUIRES_RECONCILIATION",
        providerResponse: toJson({
          httpStatus: response.status,
          outcome: "UNREADABLE_RESPONSE",
          reference: providerReference,
        }),
      },
    });

    throw new Error(
      "Paystack returned an unreadable response. Reconciliation is required."
    );
  }

  if (!response.ok || result.status !== true) {
    const definitiveRejection =
      response.status >= 400 &&
      response.status < 500 &&
      result.status === false;

    await db.refundOperation.updateMany({
      where: {
        id: operationId,
        status: "PROCESSING",
      },
      data: {
        status: definitiveRejection
          ? "FAILED"
          : "REQUIRES_RECONCILIATION",
        providerResponse: toJson({
          httpStatus: response.status,
          response: result,
          reference: providerReference,
        }),
      },
    });

    throw new Error(
      definitiveRejection
        ? `Paystack rejected the refund: ${result.message ?? "Unknown reason"}.`
        : "Paystack refund outcome is uncertain. Reconciliation is required."
    );
  }

     if (result.data?.reference !== providerReference) {
    await db.refundOperation.updateMany({
      where: {
        id: operationId,
        status: "PROCESSING",
        providerReference,
      },
      data: {
        status: "REQUIRES_RECONCILIATION",
        providerResponse: toJson({
          outcome: "REFERENCE_MISMATCH",
          expectedReference: providerReference,
          response: result,
        }),
      },
    });

    throw new Error(
      "Paystack returned an unexpected refund reference. Reconciliation is required."
    );
  }

  // Paystack acceptance is not proof that the refund has been processed.
  // Keep the operation PROCESSING until a verified webhook confirms it.
  await db.refundOperation.updateMany({
    where: {
      id: operationId,
      status: "PROCESSING",
      providerReference,
    },
    data: {
      providerResponse: toJson(result),
    },
  });

  return {
    success: true,
    status: "PROCESSING",
    providerReference,
    providerStatus: result.data?.status ?? "unknown",
    message: result.message ?? "Refund submitted to Paystack.",
  };
}