 import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { authorizeSeller } from "@/lib/seller-auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { RefundOperationStatus } from "@prisma/client";

export const runtime = "nodejs";

const RETURN_REASONS = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "MISSING_ITEM",
] as const;

const RESERVED_REFUND_STATUSES: RefundOperationStatus[] = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "REQUIRES_RECONCILIATION",
];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    let sellerId: string | null = null;

    if (role === "SELLER_OWNER" || role === "SELLER_STAFF") {
      const access = await authorizeSeller("manage_orders");

      if (!access.authorized) return access.response;

      sellerId = access.sellerId;
    } else if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const orderItemId = typeof body.orderItemId === "string" ? body.orderItemId.trim() : "";
    const quantity = Number(body.quantity);
    const reason = typeof body.reason === "string" ? body.reason.trim().toUpperCase() : "";

    if (
      !orderItemId ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      !RETURN_REASONS.includes(reason as typeof RETURN_REASONS[number])
    ) {
      return NextResponse.json({ error: "Invalid return request." }, { status: 400 });
    }

    const initialItem = await db.orderItem.findUnique({
      where: { id: orderItemId },
      select: { orderId: true },
    });

    if (!initialItem) {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM orders
        WHERE id = ${initialItem.orderId}
        FOR UPDATE
      `;

      const item = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: { returns: true },
      });

      if (!item || item.orderId !== initialItem.orderId) {
        throw new Error("ORDER_ITEM_NOT_FOUND");
      }

      if (sellerId && item.sellerId !== sellerId) {
        throw new Error("SELLER_ACCESS_DENIED");
      }

      if (item.status !== "DELIVERED" || !item.deliveredAt) {
        throw new Error("ITEM_NOT_DELIVERED");
      }

      const age = Date.now() - item.deliveredAt.getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (age < 0 || age > sevenDays) {
        throw new Error("RETURN_WINDOW_EXPIRED");
      }

      const previousRefunds = await tx.refundOperationItem.findMany({
        where: {
          orderItemId,
          refundOperation: {
            status: { in: RESERVED_REFUND_STATUSES },
          },
        },
        select: { refundedQuantity: true },
      });

      const refundedQuantity = previousRefunds.reduce(
        (sum, record) => sum + record.refundedQuantity,
        0
      );

      const reservedReturns = item.returns
        .filter((record) => record.status !== "REJECTED" && !record.refundOperationId)
        .reduce((sum, record) => sum + record.quantity, 0);

      const availableQuantity =
        item.quantity - refundedQuantity - reservedReturns;

      if (quantity > availableQuantity || availableQuantity <= 0) {
        throw new Error("INSUFFICIENT_RETURN_QUANTITY");
      }

      return tx.return.create({
        data: {
          orderId: item.orderId,
          orderItemId: item.id,
          createdById: userId,
          reason,
          quantity,
          status: "REQUESTED",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Return request submitted successfully.",
      return: result,
    }, { status: 201 });

  } catch (error) {
    const messages: Record<string, { message: string; status: number }> = {
      ORDER_ITEM_NOT_FOUND: { message: "Order item not found.", status: 404 },
      SELLER_ACCESS_DENIED: { message: "You can only submit returns for your own store's orders.", status: 403 },
      ITEM_NOT_DELIVERED: { message: "Only delivered items can be returned.", status: 400 },
      RETURN_WINDOW_EXPIRED: { message: "The 7-day return window has expired.", status: 400 },
      INSUFFICIENT_RETURN_QUANTITY: { message: "The requested quantity is unavailable for return.", status: 400 },
    };

    const key = error instanceof Error ? error.message : "";
    const known = messages[key];

    if (known) {
      return NextResponse.json({ error: known.message }, { status: known.status });
    }

    console.error("Return request error:", error);
    return NextResponse.json({ error: "Unable to submit return request." }, { status: 500 });
  }
}