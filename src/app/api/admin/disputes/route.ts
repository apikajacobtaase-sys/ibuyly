// src/app/api/admin/disputes/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const disputes = await db.dispute.findMany({
      include: {
        order: { select: { id: true, totalAmount: true } },
        raisedByUser: { select: { email: true, firstName: true, lastName: true } },
        againstSeller: { select: { businessName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      disputes: disputes.map((d) => ({
        id: d.id,
        orderId: d.orderId,
        orderTotal: parseFloat(d.order.totalAmount.toString()),
        subject: d.subject,
        description: d.description,
        status: d.status,
        resolution: d.resolution,
        refundAmount: d.refundAmount ? parseFloat(d.refundAmount.toString()) : null,
        raisedByName: `${d.raisedByUser.firstName || ""} ${d.raisedByUser.lastName || ""}`.trim() || d.raisedByUser.email,
        raisedByEmail: d.raisedByUser.email,
        sellerName: d.againstSeller?.businessName || "N/A",
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch disputes" }, { status: 500 });
  }
}