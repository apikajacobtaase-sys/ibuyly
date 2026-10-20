// src/app/api/seller/payouts/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const RequestPayoutSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.string().min(2, "Please select a payment method"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, commissionRate: true },
    });

    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    // 1. Calculate Gross Revenue (using raw SQL for snake_case tables)
    const revenueResult = await db.$queryRaw<any[]>`
      SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as gross_revenue
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."order_id"
      WHERE oi."seller_id" = ${seller.id}
        AND o."payment_reference" IS NOT NULL
    `;
    const grossRevenue = Number(revenueResult[0]?.gross_revenue || 0);

    // 2. Calculate Net Earnings (minus platform commission)
    const commissionRate = Number(seller.commissionRate);
    const platformCommission = grossRevenue * (commissionRate / 100);
    const netEarnings = grossRevenue - platformCommission;

    // 3. Calculate Already Processed Payouts
    const processedPayouts = await db.payout.aggregate({
      where: {
        sellerId: seller.id,
        status: { in: ["APPROVED", "PROCESSING", "PAID"] },
      },
      _sum: { amount: true },
    });
    const alreadyProcessed = Number(processedPayouts._sum.amount || 0);

    const availableBalance = Math.max(0, netEarnings - alreadyProcessed);

    // 4. Fetch Payout History
    const payouts = await db.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({
      availableBalance,
      grossRevenue,
      netEarnings,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paymentReference: p.paymentReference,
        rejectionReason: p.rejectionReason,
        requestedAt: p.requestedAt,
        paidAt: p.paidAt,
      })),
    });
  } catch (error: any) {
    console.error("🚨 Seller payouts GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validation = RequestPayoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    const { amount, paymentMethod } = validation.data;

    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, commissionRate: true },
    });

    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    // Recalculate available balance to ensure they aren't requesting more than they have
    const revenueResult = await db.$queryRaw<any[]>`
      SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as gross_revenue
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."order_id"
      WHERE oi."seller_id" = ${seller.id}
        AND o."payment_reference" IS NOT NULL
    `;
    const grossRevenue = Number(revenueResult[0]?.gross_revenue || 0);
    const netEarnings = grossRevenue * (1 - Number(seller.commissionRate) / 100);

    const processedPayouts = await db.payout.aggregate({
      where: { sellerId: seller.id, status: { in: ["APPROVED", "PROCESSING", "PAID"] } },
      _sum: { amount: true },
    });
    const availableBalance = Math.max(0, netEarnings - Number(processedPayouts._sum.amount || 0));

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Requested amount exceeds available balance of GH₵ ${availableBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    const payout = await db.payout.create({
      data: {
        sellerId: seller.id,
        amount,
        paymentMethod,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, payoutId: payout.id }, { status: 201 });
  } catch (error: any) {
    console.error("🚨 Seller payouts POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to request payout" }, { status: 500 });
  }
}