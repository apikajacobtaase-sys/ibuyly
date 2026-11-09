import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { calculateSellerBalance } from "@/lib/finance/accounting";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authorizeSeller } from "@/lib/seller-auth";

export const dynamic = "force-dynamic";

type FinanceDb = Prisma.TransactionClient | typeof db;

const PayoutRequestSchema = z.object({
  amount: z.number()
    .finite()
    .positive()
    .max(100000000)
    .refine(
      (value) => Number.isInteger(value * 100),
      "Amount must have at most two decimal places"
    ),

  paymentMethod: z.enum(["BANK_TRANSFER", "MOBILE_MONEY"]),

  paymentDetails: z.object({
    accountName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().min(5).max(40),
    bankName: z.string().trim().min(2).max(100).optional(),
    network: z.string().trim().min(2).max(50).optional(),
  }).strict(),
}).strict().superRefine((data, ctx) => {
  if (
    data.paymentMethod === "BANK_TRANSFER" &&
    !data.paymentDetails.bankName
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDetails", "bankName"],
      message: "Bank name is required for bank transfers",
    });
  }

  if (
    data.paymentMethod === "MOBILE_MONEY" &&
    !data.paymentDetails.network
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDetails", "network"],
      message: "Mobile money network is required",
    });
  }
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
    const access = await authorizeSeller("view_finances");

    if (!access.authorized) {
      return access.response;
    }

    const finances = await getSellerFinanceData(access.sellerId);

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
    const access = await authorizeSeller("view_finances");

    if (!access.authorized) {
      return access.response;
    }

    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the seller owner can request payouts" },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const parsed = PayoutRequestSchema.safeParse(body);

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
      const sellers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM seller_profiles
        WHERE id = ${access.sellerId}
          AND user_id = ${access.userId}
          AND is_active = true
          AND verification_status = 'VERIFIED'
        FOR UPDATE
      `;

      if (sellers.length === 0) {
        return {
          error: "Verified seller profile not found",
          status: 403,
        } as const;
      }

      const finances = await getSellerFinanceData(access.sellerId, tx);

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
          sellerId: access.sellerId,
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