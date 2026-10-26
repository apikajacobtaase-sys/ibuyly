import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { calculateSellerBalance } from "@/lib/finance/accounting";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
type FinanceDb = Prisma.TransactionClient | typeof db;
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

async function getSellerFinanceData(
  sellerId: string,
  client: FinanceDb = db
) {

const [records, payouts] = await Promise.all([
  client.sellerFinancialRecord.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  }),
  client.payout.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  }),
]);

const amountOf = (value: { toNumber(): number } | number) =>
typeof value === "number" ? value : value.toNumber();

const grossSales = records
.filter((record) => record.type === "SALE")
.reduce((sum, record) => sum + amountOf(record.amount), 0);

const marketplaceFees = Math.abs(
records
.filter((record) => record.type === "FEE")
.reduce((sum, record) => sum + amountOf(record.amount), 0)
);

const refunds = Math.abs(
records
.filter((record) => record.type === "REFUND")
.reduce((sum, record) => sum + amountOf(record.amount), 0)
);
const balance = calculateSellerBalance(
  records.map((record) => ({
    id: record.id,
    type: record.type as
      | "SALE"
      | "FEE"
      | "DISCOUNT"
      | "REFUND"
      | "FEE_REVERSAL"
      | "DISCOUNT_REVERSAL"
      | "ADJUSTMENT"
      | "PAYOUT",
    amount: amountOf(record.amount),
  })),
  payouts.map((payout) => ({
    id: payout.id,
    amount: amountOf(payout.amount),
    status: payout.status as
      | "PENDING"
      | "APPROVED"
      | "PROCESSING"
      | "PAID"
      | "REJECTED"
      | "FAILED",
  }))
);

const totalPaidOut = balance.paidOut;
const netEarnings = balance.earnedBalance;
const availableBalance = balance.availableBalance;


return {
grossSales: Number(grossSales.toFixed(2)),
marketplaceFees: Number(marketplaceFees.toFixed(2)),
netBalance: Number(balance.earnedBalance.toFixed(2)),
totalPaidOut: Number(balance.paidOut.toFixed(2)),
availableBalance: Number(balance.availableBalance.toFixed(2)),
currency: "GHS",
records: records.slice(0, 100).map((record) => ({
id: record.id,
type: record.type,
amount: amountOf(record.amount),
description: record.description || record.type,
createdAt: record.createdAt.toISOString(),
})),

pendingPayouts: payouts
  .filter((payout) =>
    ["PENDING", "APPROVED", "PROCESSING"].includes(payout.status)
  )
  .map((payout) => ({
    id: payout.id,
    amount: amountOf(payout.amount),
    paymentMethod: payout.paymentMethod || "UNKNOWN",
    status: payout.status,
    createdAt: payout.createdAt.toISOString(),
  })),
};
}

export async function GET() {
try {
const session = await getServerSession(authOptions);

if (!session?.user?.id) {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

const seller = await db.sellerProfile.findUnique({
  where: { userId: session.user.id },
  select: { id: true },
});

if (!seller) {
  return NextResponse.json(
    { error: "Seller profile not found" },
    { status: 403 }
  );
}

const finances = await getSellerFinanceData(seller.id);

return NextResponse.json(finances);

} catch (error) {
console.error("[SELLER FINANCES] GET error:", error);

return NextResponse.json(
  { error: "Failed to fetch seller finances" },
  { status: 500 }
);

}
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const parsed = PayoutRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payout request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { amount, paymentMethod, paymentDetails } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      // Lock this seller's database row. Concurrent payout requests
      // for the same seller must wait until this transaction finishes.
      const sellers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM seller_profiles
        WHERE user_id = ${session.user.id}
        FOR UPDATE
      `;

      const seller = sellers[0];

      if (!seller) {
        return {
          error: "Seller profile not found",
          status: 403,
        } as const;
      }

      // Read financial records and payouts through the transaction client
      // while the seller row is locked.
      const finances = await getSellerFinanceData(seller.id, tx);

      if (amount > finances.availableBalance + 0.000001) {
        return {
          error: "Insufficient available balance",
          availableBalance: finances.availableBalance,
          currency: "GHS",
          status: 400,
        } as const;
      }

      const payout = await tx.payout.create({
        data: {
          sellerId: seller.id,
          amount,
          currency: "GHS",
          status: "PENDING",
          paymentMethod,
          paymentDetails,
        },
      });

      return {
        payoutId: payout.id,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        {
          error: result.error,
          ...("availableBalance" in result
            ? {
                availableBalance: result.availableBalance,
                currency: result.currency,
              }
            : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        payoutId: result.payoutId,
        message: "Payout request submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SELLER FINANCES] POST error:", error);

    return NextResponse.json(
      { error: "Failed to request payout" },
      { status: 500 }
    );
  }
}





