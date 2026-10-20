// src/app/api/vouchers/validate/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const ValidateVoucherSchema = z.object({
  code: z.string().min(1).max(50),
  orderAmount: z.number().positive(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = ValidateVoucherSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { code, orderAmount } = parseResult.data;

    // Find the voucher
    const voucher = await db.voucher.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!voucher) {
      return NextResponse.json({ valid: false, error: "Voucher code not found" });
    }

    // Check if active
    if (!voucher.isActive) {
      return NextResponse.json({ valid: false, error: "This voucher is no longer active" });
    }

    // Check date range
    const now = new Date();
    if (voucher.startsAt && now < voucher.startsAt) {
      return NextResponse.json({ valid: false, error: "This voucher is not yet valid" });
    }
    if (voucher.expiresAt && now > voucher.expiresAt) {
      return NextResponse.json({ valid: false, error: "This voucher has expired" });
    }

    // Check usage limit
    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return NextResponse.json({ valid: false, error: "This voucher has reached its usage limit" });
    }

    // Check minimum order amount
    if (voucher.minOrderAmount && orderAmount < voucher.minOrderAmount.toNumber()) {
      return NextResponse.json({
        valid: false,
        error: `Minimum order amount is GH₵ ${voucher.minOrderAmount.toNumber().toFixed(2)}`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.type === "PERCENTAGE") {
      discountAmount = (orderAmount * voucher.value.toNumber()) / 100;
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount.toNumber()) {
        discountAmount = voucher.maxDiscount.toNumber();
      }
    } else if (voucher.type === "FIXED") {
      discountAmount = voucher.value.toNumber();
      if (discountAmount > orderAmount) {
        discountAmount = orderAmount; // Can't discount more than the order total
      }
    }

    return NextResponse.json({
      valid: true,
      discountAmount: Math.round(discountAmount * 100) / 100,
      message: voucher.description || `GH₵ ${discountAmount.toFixed(2)} discount applied!`,
    });
  } catch (error) {
    console.error("Voucher validation error:", error);
    return NextResponse.json({ error: "Failed to validate voucher" }, { status: 500 });
  }
}