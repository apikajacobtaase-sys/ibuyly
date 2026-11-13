 import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { createRefundOperationInTransaction } from "@/lib/refunds/create-refund-operation";
import { executeRefundOperation } from "@/lib/refunds/execute-refund-operation";

export const runtime = "nodejs";

type RefundRequestBody = {
  reason?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toCents(value: Prisma.Decimal): number {
  const amount = value.toNumber();
  const cents = Math.round(amount * 100);

  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(cents) ||
    Math.abs(amount * 100 - cents) > 1e-7
  ) {
    throw new Error("Invalid financial amount.");
  }

  return cents;
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

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();

    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      return jsonError("A valid Idempotency-Key header is required.", 400);
    }

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

    if (!reason) {
      return jsonError("A refund reason is required.", 400);
    }

    const reservation = await db.$transaction(
      async (tx) => {
        // Serialize administrative refund/cancellation requests for this order.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM orders
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new Error("ORDER_NOT_FOUND");
        }

        // Idempotency check must happen before changing item statuses.
        const existing = await tx.refundOperation.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });

        if (existing) {
          if (
            existing.orderId !== id ||
            existing.initiatedById !== session.user.id ||
            existing.initiatedByType !== "ADMIN" ||
            existing.reason !== reason
          ) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }

          return {
            operation: existing,
            alreadyReserved: true,
          };
        }

        const order = await tx.order.findUnique({
          where: { id },
          include: {
            payment: true,
            items: true,
          },
        });

        if (!order) {
          throw new Error("ORDER_NOT_FOUND");
        }

        if (!order.payment) {
          throw new Error("PAYMENT_NOT_FOUND");
        }

        if (order.payment.status !== "SUCCESSFUL") {
          throw new Error("PAYMENT_NOT_REFUNDABLE");
        }

        if (
          order.payment.provider !== "PAYSTACK" ||
          !order.payment.providerTransactionId
        ) {
          throw new Error("PAYMENT_PROVIDER_UNSUPPORTED");
        }

        if (order.items.length === 0) {
          throw new Error("ORDER_HAS_NO_ITEMS");
        }

        if (
          toCents(order.totalAmount) !==
          toCents(order.payment.amount)
        ) {
          throw new Error("ORDER_PAYMENT_MISMATCH");
        }

        // Cancel each item and restore stock only when its previous
        // status indicates that stock was still reserved.
        for (const item of order.items) {
          if (item.status === "CANCELLED") {
            continue;
          }

          if (
            ![
              "PENDING",
              "CONFIRMED",
              "PROCESSING",
              "SHIPPED",
              "DELIVERED",
            ].includes(item.status)
          ) {
            throw new Error(
              `Unsupported item status for cancellation: ${item.status}`
            );
          }

          const updated = await tx.orderItem.updateMany({
            where: {
              id: item.id,
              orderId: id,
              status: item.status,
            },
            data: {
              status: "CANCELLED",
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              `Item ${item.id} changed during cancellation.`
            );
          }

          // Shipped and delivered goods must physically return
          // before stock is restored.
          if (
            ["PENDING", "CONFIRMED", "PROCESSING"].includes(
              item.status
            )
          ) {
            if (!item.offerId || !item.sellerId) {
              throw new Error(
                `Cannot restore stock for item ${item.id}: offer or seller is missing.`
              );
            }

            const restored = await tx.sellerOffer.updateMany({
              where: {
                id: item.offerId,
                sellerId: item.sellerId,
              },
              data: {
                stockQuantity: {
                  increment: item.quantity,
                },
              },
            });

            if (restored.count !== 1) {
              throw new Error(
                `Stock restoration failed for item ${item.id}.`
              );
            }
          }
        }

        // The order is cancelled immediately, while its refund
        // remains pending until Paystack confirms completion.
        await tx.order.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        // Read existing reservations after cancellation.
        const previousOperations = await tx.refundOperation.findMany({
          where: {
            orderId: id,
            status: {
              in: [
                "PENDING",
                "PROCESSING",
                "SUCCEEDED",
                "REQUIRES_RECONCILIATION",
              ],
            },
          },
          include: { items: true },
        });

        const reservedByItem = new Map<string, number>();
        let deliveryAlreadyReserved = false;

        for (const operation of previousOperations) {
          if (toCents(operation.deliveryFeeAmount) > 0) {
            deliveryAlreadyReserved = true;
          }

          for (const operationItem of operation.items) {
            reservedByItem.set(
              operationItem.orderItemId,
              (reservedByItem.get(operationItem.orderItemId) ?? 0) +
                operationItem.refundedQuantity
            );
          }
        }

        // Only reserve quantities not already covered by another
        // active, successful, or reconciliation-required operation.
        const remainingItems = order.items
          .map((item) => {
            const reserved =
              reservedByItem.get(item.id) ?? 0;

            if (reserved > item.quantity) {
              throw new Error(
                `Refund reservations exceed the quantity of item ${item.id}.`
              );
            }

            return {
              orderItemId: item.id,
              quantity: item.quantity - reserved,
            };
          })
          .filter((item) => item.quantity > 0);

        const includeDeliveryFee = !deliveryAlreadyReserved;

        // Nothing new remains to refund.
        if (
          remainingItems.length === 0 &&
          (!includeDeliveryFee ||
            toCents(order.deliveryFee) === 0)
        ) {
          const latestOperation = previousOperations.sort(
            (a, b) =>
              b.createdAt.getTime() - a.createdAt.getTime()
          )[0];

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: "ORDER_REFUND_ALREADY_RESERVED",
              resourceType: "Order",
              resourceId: id,
              metadata: {
                reason,
                existingOperationId: latestOperation?.id ?? null,
              } as Prisma.InputJsonValue,
            },
          });

          return {
            operation: latestOperation ?? null,
            alreadyReserved: true,
          };
        }

        const operation = await createRefundOperationInTransaction(
          tx,
          {
            orderId: id,
            initiatedById: session.user.id,
            initiatedByType: "ADMIN",
            reason,
            idempotencyKey,
            items: remainingItems,
            includeDeliveryFee,
          }
        );

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: "ORDER_REFUND_INITIATED",
            resourceType: "Order",
            resourceId: id,
            metadata: {
              operationId: operation.id,
              amount: operation.amount.toNumber(),
              merchandiseAmount:
                operation.merchandiseAmount.toNumber(),
              deliveryFeeAmount:
                operation.deliveryFeeAmount.toNumber(),
              reason,
              provider: "PAYSTACK",
              providerTransactionId:
                order.payment.providerTransactionId,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          operation,
          alreadyReserved: false,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );

    const operation = reservation.operation;

    if (!operation) {
      return NextResponse.json({
        success: true,
        status: "PROCESSING",
        message:
          "The order has been cancelled. Its refund amount is already accounted for by existing refund operations.",
      });
    }

    // Never submit an operation that has already been claimed,
    // completed, failed, or marked for reconciliation.
    if (operation.status === "PENDING") {
      try {
        await executeRefundOperation(operation.id);
      } catch (error) {
        console.error("[ADMIN REFUND] Execution error:", error);
      }
    }

    const currentOperation = await db.refundOperation.findUnique({
      where: { id: operation.id },
    });

    if (!currentOperation) {
      return jsonError(
        "Refund operation could not be retrieved. Reconciliation is required.",
        500
      );
    }

    if (currentOperation.status === "FAILED") {
      return NextResponse.json(
        {
          success: false,
          operationId: currentOperation.id,
          status: currentOperation.status,
          error:
            "Paystack rejected the refund. Review the operation before initiating another attempt.",
        },
        { status: 502 }
      );
    }

    if (
      currentOperation.status === "REQUIRES_RECONCILIATION"
    ) {
      return NextResponse.json(
        {
          success: false,
          operationId: currentOperation.id,
          status: currentOperation.status,
          error:
            "The refund outcome is uncertain. Reconcile it with Paystack before attempting another refund.",
        },
        { status: 202 }
      );
    }

    if (currentOperation.status === "SUCCEEDED") {
      return NextResponse.json({
        success: true,
        operationId: currentOperation.id,
        status: "SUCCEEDED",
        message: "The refund has been completed successfully.",
      });
    }

    return NextResponse.json(
      {
        success: true,
        operationId: currentOperation.id,
        status: currentOperation.status,
        message:
          reservation.alreadyReserved
            ? "This refund is already reserved and is being processed."
            : "The order has been cancelled and the refund has been submitted to Paystack. Final confirmation is pending.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[ADMIN REFUND] Failed:", error);

    const message =
      error instanceof Error ? error.message : "";

    if (message === "ORDER_NOT_FOUND") {
      return jsonError("Order not found.", 404);
    }

    if (message === "IDEMPOTENCY_CONFLICT") {
      return jsonError(
        "This idempotency key belongs to a different refund request.",
        409
      );
    }

    const conflicts: Record<string, string> = {
      PAYMENT_NOT_FOUND: "No payment record exists for this order.",
      PAYMENT_NOT_REFUNDABLE:
        "Only successfully paid orders can be refunded.",
      PAYMENT_PROVIDER_UNSUPPORTED:
        "Automated refunds require a valid Paystack transaction.",
      ORDER_HAS_NO_ITEMS: "This order contains no items.",
      ORDER_PAYMENT_MISMATCH:
        "Order total and payment amount do not reconcile.",
    };

    if (conflicts[message]) {
      return jsonError(conflicts[message], 409);
    }

    if (
      message.includes("Refund") ||
      message.includes("refund") ||
      message.includes("reconciliation") ||
      message.includes("ledger") ||
      message.includes("stock") ||
      message.includes("Item ") ||
      message.includes("item ") ||
      message.includes("discount") ||
      message.includes("commission") ||
      message.includes("Delivery")
    ) {
      return jsonError(message, 409);
    }

    return jsonError("Failed to process refund.", 500);
  }
}