 import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { createRefundOperationInTransaction } from "@/lib/refunds/create-refund-operation";
import { executeRefundOperation } from "@/lib/refunds/execute-refund-operation";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin only." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const initialReturn = await db.return.findUnique({
      where: { id },
      select: { orderId: true },
    });

    if (!initialReturn) {
      return NextResponse.json(
        { error: "Return request not found." },
        { status: 404 }
      );
    }

    const operation = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM orders
        WHERE id = ${initialReturn.orderId}
        FOR UPDATE
      `;

      const returnRequest = await tx.return.findUnique({
        where: { id },
        include: { refundOperation: true },
      });

      if (!returnRequest || returnRequest.orderId !== initialReturn.orderId) {
        throw new Error("RETURN_NOT_FOUND");
      }

      if (returnRequest.status !== "RECEIVED") {
        throw new Error("RETURN_NOT_RECEIVED");
      }

      // Reuse an already-created operation; never create a duplicate refund.
      if (returnRequest.refundOperation) {
        const existing = returnRequest.refundOperation;

        if (existing.status === "FAILED") {
          throw new Error("REFUND_FAILED");
        }

        return existing;
      }

      const created = await createRefundOperationInTransaction(tx, {
        orderId: returnRequest.orderId,
        initiatedById: session.user.id,
        initiatedByType: "ADMIN",
        reason: `Return ${returnRequest.id}: ${returnRequest.reason}`,
        idempotencyKey: `return:${returnRequest.id}`,
        items: [
          {
            orderItemId: returnRequest.orderItemId,
            quantity: returnRequest.quantity,
          },
        ],
        includeDeliveryFee: false,
      });

      await tx.return.update({
        where: { id },
        data: {
          refundOperationId: created.id,
        },
      });

      return created;
    });

    if (operation.status === "PENDING") {
      try {
        await executeRefundOperation(operation.id);
      } catch (error) {
        console.error("Return refund execution error:", error);
      }
    }

    const currentOperation = await db.refundOperation.findUnique({
      where: { id: operation.id },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        providerReference: true,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Refund operation created. The return will be marked refunded only after successful payment confirmation.",
      refundOperation: currentOperation,
    });
  } catch (error) {
    const errors: Record<string, { message: string; status: number }> = {
      RETURN_NOT_FOUND: {
        message: "Return request not found.",
        status: 404,
      },
      RETURN_NOT_RECEIVED: {
        message: "Only physically received returns can be refunded.",
        status: 400,
      },
      REFUND_FAILED: {
        message: "The linked refund operation failed. Review it before taking further action.",
        status: 409,
      },
    };

    const key = error instanceof Error ? error.message : "";
    const known = errors[key];

    if (known) {
      return NextResponse.json(
        { error: known.message },
        { status: known.status }
      );
    }

    console.error("Return refund error:", error);

    return NextResponse.json(
      { error: "Unable to initiate return refund." },
      { status: 500 }
    );
  }
}