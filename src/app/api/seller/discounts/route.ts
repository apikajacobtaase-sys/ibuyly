// src/app/api/seller/discounts/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const CreateDiscountSchema = z.object({
  code: z.string().min(3).max(20).transform((val) => val.toUpperCase().replace(/\s+/g, "_")),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number().positive(),
  minOrderAmount: z.number().optional().nullable(),
  maxDiscount: z.number().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const discounts = await db.discountCode.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      discounts: discounts.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: Number(d.value),
        minOrderAmount: d.minOrderAmount ? Number(d.minOrderAmount) : null,
        maxDiscount: d.maxDiscount ? Number(d.maxDiscount) : null,
        usageLimit: d.usageLimit,
        usedCount: d.usedCount,
        startsAt: d.startsAt,
        expiresAt: d.expiresAt,
        isActive: d.isActive,
      })),
    });
  } catch (error: any) {
    console.error("🚨 Seller discounts GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const body = await req.json();
    const validation = CreateDiscountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    const { code, type, value, minOrderAmount, maxDiscount, usageLimit, expiresAt } = validation.data;

    // Check if code already exists
    const existing = await db.discountCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "This discount code already exists. Please choose another." }, { status: 400 });
    }

    const discount = await db.discountCode.create({
      data: {
        sellerId: seller.id,
        code,
        type,
        value,
        minOrderAmount: minOrderAmount || null,
        maxDiscount: maxDiscount || null,
        usageLimit: usageLimit || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ success: true, discountId: discount.id }, { status: 201 });
  } catch (error: any) {
    console.error("🚨 Seller discounts POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const discountId = searchParams.get("id");

    if (!discountId) return NextResponse.json({ error: "Discount ID required" }, { status: 400 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    await db.discountCode.delete({
      where: { id: discountId, sellerId: seller.id }, // Ensures seller can only delete their own
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🚨 Seller discounts DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}