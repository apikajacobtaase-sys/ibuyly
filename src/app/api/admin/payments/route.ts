// src/app/api/admin/payments/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const provider = searchParams.get("provider") || "";

    const where: any = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const payments = await db.payment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            totalAmount: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        provider: p.provider,
        amount: parseFloat(p.amount.toString()),
        currency: p.currency,
        status: p.status,
        providerTransactionId: p.providerTransactionId,
        customerEmail: p.order.user.email,
        customerName: `${p.order.user.firstName || ""} ${p.order.user.lastName || ""}`.trim(),
        orderTotal: parseFloat(p.order.totalAmount.toString()),
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Payments fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}