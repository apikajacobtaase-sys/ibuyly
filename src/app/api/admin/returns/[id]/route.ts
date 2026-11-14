 import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ReturnAction = "APPROVE" | "REJECT" | "RECEIVE";

export async function PATCH(
  req: Request,
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
    const body = await req.json();

    const action = body.action as ReturnAction;
    const reviewNote =
      typeof body.reviewNote === "string"
        ? body.reviewNote.trim()
        : "";

    if (!["APPROVE", "REJECT", "RECEIVE"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid return action." },
        { status: 400 }
      );
    }

    if (reviewNote.length > 1000) {
      return NextResponse.json(
        { error: "Review note cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

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

    const updatedReturn = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM orders
        WHERE id = ${initialReturn.orderId}
        FOR UPDATE
      `;

      const returnRequest = await tx.return.findUnique({
        where: { id },
      });

      if (!returnRequest) {
        throw new Error("RETURN_NOT_FOUND");
      }

      if (returnRequest.orderId !== initialReturn.orderId) {
        throw new Error("RETURN_CHANGED");
      }

      const now = new Date();

      if (action === "APPROVE") {
        if (returnRequest.status !== "REQUESTED") {
          throw new Error("INVALID_APPROVAL_STATUS");
        }

        return tx.return.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedById: session.user.id,
            reviewedAt: now,
            ...(reviewNote ? { reviewNote } : {}),
          },
        });
      }

      if (action === "REJECT") {
        if (returnRequest.status !== "REQUESTED") {
          throw new Error("INVALID_REJECTION_STATUS");
        }

        return tx.return.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            reviewedAt: now,
            ...(reviewNote ? { reviewNote } : {}),
          },
        });
      }

      if (returnRequest.status !== "APPROVED") {
        throw new Error("INVALID_RECEIVE_STATUS");
      }

      return tx.return.update({
        where: { id },
        data: {
          status: "RECEIVED",
          receivedAt: now,
          ...(reviewNote ? { reviewNote } : {}),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Return request ${action.toLowerCase()}d successfully.`,
      return: updatedReturn,
    });
  } catch (error) {
    const errors: Record<string, { message: string; status: number }> = {
      RETURN_NOT_FOUND: {
        message: "Return request not found.",
        status: 404,
      },
      RETURN_CHANGED: {
        message: "Return request changed. Please try again.",
        status: 409,
      },
      INVALID_APPROVAL_STATUS: {
        message: "Only requested returns can be approved.",
        status: 400,
      },
      INVALID_REJECTION_STATUS: {
        message: "Only requested returns can be rejected.",
        status: 400,
      },
      INVALID_RECEIVE_STATUS: {
        message: "Only approved returns can be marked as received.",
        status: 400,
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

    console.error("Return review error:", error);

    return NextResponse.json(
      { error: "Unable to update return request." },
      { status: 500 }
    );
  }
}