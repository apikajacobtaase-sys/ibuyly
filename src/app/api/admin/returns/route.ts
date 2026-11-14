import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VALID_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "REFUNDED",
] as const;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin only." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: "Invalid return status." }, { status: 400 });
    }

    const returns = await db.return.findMany({
      where: status ? { status: status as typeof VALID_STATUSES[number] } : undefined,
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        orderItem: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        refundOperation: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ returns });
  } catch (error) {
    console.error("Admin returns fetch error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve return requests." },
      { status: 500 }
    );
  }
}