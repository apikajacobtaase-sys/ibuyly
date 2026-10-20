// src/app/api/admin/payouts/route.ts
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

    const payouts = await db.payout.findMany({
      include: {
        seller: {
          select: {
            businessName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        sellerId: p.sellerId,
        sellerName: p.seller.businessName,
        sellerEmail: p.seller.user.email,
        amount: parseFloat(p.amount.toString()),
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paymentDetails: p.paymentDetails,
        notes: p.notes,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}