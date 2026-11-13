 import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { finalizeRefundOperation } from "@/lib/refunds/finalize-refund-operation";

export const runtime = "nodejs";

type PaystackRefund = {
  id?: number;
  reference?: string;
  transaction?: number;
  amount?: number;
  currency?: string;
  status?: string;
};

type PaystackResponse<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return jsonError("Unauthorized.", 403);
    }

    const { id } = await params;

    const operation = await db.refundOperation.findUnique({
      where: { id },
      include: {
        payment: true,
        order: true,
      },
    });

    if (!operation) {
      return jsonError("Refund operation not found.", 404);
    }

    if (operation.status === "SUCCEEDED") {
      return NextResponse.json({
        success: true,
        status: "SUCCEEDED",
        alreadyCompleted: true,
      });
    }

    if (operation.status !== "REQUIRES_RECONCILIATION") {
      return jsonError(
        `Cannot reconcile refund from status ${operation.status}.`,
        409
      );
    }

    if (
      operation.provider !== "PAYSTACK" ||
      operation.payment.provider !== "PAYSTACK" ||
      !operation.payment.providerTransactionId ||
      !operation.providerReference
    ) {
      return jsonError(
        "Refund operation has incomplete Paystack references.",
        409
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return jsonError("Paystack is not configured.", 500);
    }

    const headers = {
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    };

    // Retrieve the existing refund. This does not create another refund.
    const refundUrl = new URL("https://api.paystack.co/refund");
    refundUrl.searchParams.set("reference", operation.providerReference);

    const refundResponse = await fetch(refundUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!refundResponse.ok) {
      throw new Error(
        `Paystack refund lookup returned HTTP ${refundResponse.status}.`
      );
    }

    const refundResult =
      (await refundResponse.json()) as PaystackResponse<PaystackRefund[]>;

    if (refundResult.status !== true || !Array.isArray(refundResult.data)) {
      throw new Error("Invalid Paystack refund lookup response.");
    }

    const matches = refundResult.data.filter(
      (refund) =>
        refund.reference?.toLowerCase() ===
        operation.providerReference?.toLowerCase()
    );

    if (matches.length === 0) {
      return NextResponse.json(
        {
          success: false,
          status: "REQUIRES_RECONCILIATION",
          message:
            "Paystack has not returned this refund yet. No new refund was submitted.",
        },
        { status: 202 }
      );
    }

    if (matches.length !== 1) {
      return jsonError(
        "Multiple Paystack refunds match this reference. Manual reconciliation is required.",
        409
      );
    }

    const refund = matches[0];

    if (
      !Number.isSafeInteger(refund.id) ||
      !Number.isSafeInteger(refund.transaction) ||
      !Number.isSafeInteger(refund.amount) ||
      typeof refund.currency !== "string" ||
      typeof refund.status !== "string"
    ) {
      throw new Error("Paystack returned incomplete refund details.");
    }

    const expectedAmount = Math.round(operation.amount.toNumber() * 100);

    if (
      refund.amount !== expectedAmount ||
      refund.currency.toUpperCase() !== operation.currency.toUpperCase()
    ) {
      throw new Error("Paystack refund amount or currency mismatch.");
    }

    // Verify the original transaction and compare its actual Paystack ID.
    const transactionUrl =
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        operation.payment.providerTransactionId
      )}`;

    const transactionResponse = await fetch(transactionUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!transactionResponse.ok) {
      throw new Error(
        `Paystack transaction verification returned HTTP ${transactionResponse.status}.`
      );
    }

    const transactionResult =
      (await transactionResponse.json()) as PaystackResponse<{
        id?: number;
        reference?: string;
        status?: string;
        currency?: string;
      }>;

    const transaction = transactionResult.data;

    if (
      transactionResult.status !== true ||
      !transaction ||
      transaction.id !== refund.transaction ||
      transaction.reference !== operation.payment.providerTransactionId ||
      transaction.status !== "success" ||
      transaction.currency?.toUpperCase() !==
        operation.payment.currency.toUpperCase()
    ) {
      throw new Error(
        "Paystack refund does not match the verified original transaction."
      );
    }

    const status = refund.status.toLowerCase();

    if (
      ![
        "pending",
        "processing",
        "processed",
        "failed",
        "needs-attention",
      ].includes(status)
    ) {
      throw new Error(`Unsupported Paystack refund status: ${status}`);
    }

    const result = await finalizeRefundOperation({
      status,
      refund_reference: refund.reference,
      transaction_reference: operation.payment.providerTransactionId,
      amount: refund.amount,
      currency: refund.currency,
    });
    
    if (!("status" in result)) {
  return jsonError(result.reason, 409);
}
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REFUND_RECONCILED",
        resourceType: "RefundOperation",
        resourceId: operation.id,
        metadata: {
          providerReference: operation.providerReference,
          providerRefundId: refund.id,
          providerStatus: status,
          resultStatus: result.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      operationId: operation.id,
      status: result.status,
      message: "Refund reconciliation completed.",
    });
  } catch (error) {
    console.error("[REFUND RECONCILIATION]", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Refund reconciliation failed.",
      500
    );
  }
}