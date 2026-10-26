
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type RefundRequestBody = {
  reason?: unknown;
  amount?: unknown;
};

type PaystackRefundResponse = {
  status?: boolean;
  message?: string;
  data?: {
    status?: string;
    [key: string]: unknown;
  };
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid monetary amount.");
  }

  return Math.round(amount * 100);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return jsonError("Unauthorized", 403);
    }

    const { id } = await params;

    let body: RefundRequestBody;

    try {
      body = (await req.json()) as RefundRequestBody;
    } catch {
      return jsonError("A valid JSON request body is required.", 400);
    }

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim().slice(0, 500)
        : "Admin-initiated refund";

    const order = await db.order.findUnique({
      where: { id },
      include: {
        payment: true,
        items: true,
      },
    });

    if (!order) {
      return jsonError("Order not found", 404);
    }

    if (!order.payment) {
      return jsonError("No payment record exists for this order.", 409);
    }

    if (order.status === "REFUNDED" || order.payment.status === "REFUNDED") {
      return jsonError("This order has already been refunded.", 409);
    }

    if (order.payment.status !== "SUCCESSFUL") {
      return jsonError(
        "Only successfully paid orders can be refunded.",
        409
      );
    }

    if (order.payment.provider !== "PAYSTACK") {
      return jsonError(
        "Automated refunds are currently supported only for Paystack payments.",
        409
      );
    }

    if (!order.payment.providerTransactionId) {
      return jsonError(
        "The Paystack transaction reference is missing.",
        409
      );
    }

    const orderTotal = order.totalAmount.toNumber();
    const paymentAmount = order.payment.amount.toNumber();

    if (
      !Number.isFinite(orderTotal) ||
      !Number.isFinite(paymentAmount) ||
      orderTotal <= 0 ||
      paymentAmount <= 0
    ) {
      return jsonError("The order or payment amount is invalid.", 409);
    }

    // This initial implementation supports full refunds only.
    // Partial refunds require durable refund-operation tracking.
    if (body.amount !== undefined && body.amount !== null) {
      const suppliedAmount =
        typeof body.amount === "number"
          ? body.amount
          : typeof body.amount === "string" && body.amount.trim() !== ""
            ? Number(body.amount)
            : NaN;

      if (
        !Number.isFinite(suppliedAmount) ||
        suppliedAmount <= 0 ||
        toCents(suppliedAmount) !== toCents(paymentAmount)
      ) {
        return jsonError(
          "Only a full refund equal to the original payment amount is supported.",
          400
        );
      }
    }

    if (toCents(orderTotal) !== toCents(paymentAmount)) {
      return jsonError(
        "The order total differs from the payment amount. Manual reconciliation is required before refunding.",
        409
      );
    }

    const refundAmount = paymentAmount;
    const refundAmountCents = toCents(refundAmount);

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error("[REFUND] PAYSTACK_SECRET_KEY is not configured.");

      return jsonError(
        "Refund service is temporarily unavailable.",
        503
      );
    }

    // IMPORTANT:
    // This request must not be blindly retried if the network times out.
    // A timeout can occur after Paystack has processed the refund.
    let refundResponse: Response;

    try {
      refundResponse = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: order.payment.providerTransactionId,
          amount: refundAmountCents,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error("[REFUND] Paystack request outcome is unknown:", error);

      return jsonError(
        "The refund outcome could not be confirmed. Do not retry automatically; reconcile the transaction with Paystack first.",
        503
      );
    }

    let paystackData: PaystackRefundResponse;

    try {
      paystackData =
        (await refundResponse.json()) as PaystackRefundResponse;
    } catch {
      console.error("[REFUND] Paystack returned an unreadable response.");

      return jsonError(
        "Paystack returned an unreadable response. Reconcile the transaction before retrying.",
        502
      );
    }

    if (!refundResponse.ok || paystackData.status !== true) {
      console.error("[REFUND] Paystack did not confirm the refund:", {
        httpStatus: refundResponse.status,
        message: paystackData.message,
      });

      return jsonError(
        "Paystack did not confirm the refund. The order and payment statuses have not been changed.",
        502
      );
    }

    // A successful API response is required before local refund processing.
    // Provider-side and database-side operations cannot be one atomic
    // transaction, so database failures require reconciliation.
    try {
      await db.$transaction(async (tx) => {
        const paymentClaim = await tx.payment.updateMany({
          where: {
            id: order.payment!.id,
            status: "SUCCESSFUL",
          },
          data: {
            status: "REFUNDED",
          },
        });

        if (paymentClaim.count !== 1) {
          throw new Error(
            "Payment status changed during refund processing."
          );
        }

        const orderUpdate = await tx.order.updateMany({
          where: {
            id,
            status: { not: "REFUNDED" },
          },
          data: {
            status: "REFUNDED",
          },
        });

        if (orderUpdate.count !== 1) {
          throw new Error(
            "Order status changed during refund processing."
          );
        }

        // Allocate the refund using each seller's item subtotal.
        // This implementation refuses to proceed if the seller subtotals
        // cannot account for the original payment amount.
        const sellerTotals = new Map<string, number>();

        for (const item of order.items) {
          if (!item.sellerId) {
            throw new Error(
              `Order item ${item.id} has no seller ID.`
            );
          }

          const lineCents =
            toCents(item.price.toNumber()) * item.quantity;

          if (!Number.isSafeInteger(lineCents) || lineCents < 0) {
            throw new Error(
              `Order item ${item.id} has an invalid line total.`
            );
          }

          sellerTotals.set(
            item.sellerId,
            (sellerTotals.get(item.sellerId) ?? 0) + lineCents
          );
        }

        const sellerSubtotalCents = [...sellerTotals.values()].reduce(
          (total, value) => total + value,
          0
        );

        // Delivery fees and discounts can make the seller subtotal differ
        // from the payment. Do not invent an allocation in that case.
        if (sellerSubtotalCents !== refundAmountCents) {
          throw new Error(
            "Seller item subtotals do not match the payment amount. Refund requires financial reconciliation."
          );
        }

        for (const [sellerId, sellerAmountCents] of sellerTotals) {
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId,
              orderId: id,
              type: "REFUND",
              amount: -(sellerAmountCents / 100),
              currency: order.payment!.currency,
              description: `Refund for order #${id.slice(-8).toUpperCase()}: ${reason || "No reason provided"}`,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: "ORDER_REFUNDED",
            resourceType: "Order",
            resourceId: id,
            metadata: {
              amount: refundAmount,
              reason,
              provider: "PAYSTACK",
              providerTransactionId:
                order.payment!.providerTransactionId,
              providerMessage: paystackData.message ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });
    } catch (error) {
      // Paystack has already accepted the refund. Never automatically call
      // Paystack again here. The database state must be reconciled.
      console.error(
        "[REFUND] Paystack accepted the refund, but local processing failed:",
        error
      );

      return jsonError(
        "Paystack accepted the refund request, but local records could not be fully updated. Contact an administrator to reconcile the refund. Do not submit another refund.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      paystackRefundSuccess: true,
      message:
        "Paystack accepted the refund request and the local refund records were updated.",
    });
  } catch (error) {
    console.error("[REFUND] Unexpected error:", error);

    return jsonError("Failed to process refund.", 500);
  }
}