import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";


export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!seller) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    return NextResponse.json({ balance: 0, payouts: [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch finances" }, { status: 500 });
  }
}

const PayoutRequestSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["BANK_TRANSFER", "MOBILE_MONEY"]),
  paymentDetails: z.object({
    accountName: z.string().min(2),
    accountNumber: z.string().min(5),
    bankName: z.string().min(2).optional(),
    network: z.string().min(2).optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-create seller profile if it doesn't exist (using CORRECT schema fields)
    let sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      sellerProfile = await db.sellerProfile.create({
        data: {
          userId: session.user.id,
          businessName: session.user.name || "My Store",
          isActive: true, // 👈 Use isActive instead of status
        },
      });
    }

    const body = await req.json();
    const parseResult = PayoutRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, paymentMethod, paymentDetails } = parseResult.data;

    const records = await db.sellerFinancialRecord.findMany({
      where: { sellerId: sellerProfile.id },
      select: { amount: true, id: true },
    });

    const balance = records.reduce((sum, record) => sum + (record.amount ? record.amount.toNumber() : 0), 0);

    if (amount > balance) {
      return NextResponse.json(
        { error: "Insufficient balance. Available: GHS " + balance.toFixed(2) },
        { status: 400 }
      );
    }

    const payout = await db.payout.create({
      data: {
        sellerId: sellerProfile.id,
        amount,
        currency: "GHS",
        status: "PENDING",
        paymentMethod,
        paymentDetails: paymentDetails as any,
      },
    });

    return NextResponse.json({ success: true, payoutId: payout.id }, { status: 201 });
  } catch (error: any) {
    console.error("🚨 Payout request error:", error);
    return NextResponse.json({ error: error.message || "Failed to request payout" }, { status: 500 });
  }
}