  import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code, orderTotal, sellerIds = [] } = await req.json();

    if (!code || !orderTotal) {
      return NextResponse.json({ error: "Code and order total are required" }, { status: 400 });
    }

    const discount = await db.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount) {
      return NextResponse.json({ error: "Invalid discount code" }, { status: 404 });
    }

    if (!discount.isActive) {
      return NextResponse.json({ error: "This discount code is no longer active" }, { status: 400 });
    }

    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return NextResponse.json({ error: "This discount code has expired" }, { status: 400 });
    }

    // ✅ CHECK SELLER RESTRICTION
    // If the discount has a sellerId, it only applies if that seller is in the cart
    if (discount.sellerId && !sellerIds.includes(discount.sellerId)) {
      return NextResponse.json({ 
        error: "This code is only valid for specific sellers." 
      }, { status: 400 });
    }

    if (discount.minOrderAmount && orderTotal < Number(discount.minOrderAmount)) {
      return NextResponse.json({ 
        error: `Minimum order of GH₵ ${Number(discount.minOrderAmount).toFixed(2)} required.` 
      }, { status: 400 });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === "PERCENTAGE") {
      discountAmount = orderTotal * (Number(discount.value) / 100);
      if (discount.maxDiscount && discountAmount > Number(discount.maxDiscount)) {
        discountAmount = Number(discount.maxDiscount);
      }
    } else {
      discountAmount = Number(discount.value);
    }

    // Ensure discount doesn't exceed order total
    if (discountAmount > orderTotal) {
      discountAmount = orderTotal;
    }

    return NextResponse.json({
      valid: true,
      discountId: discount.id,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      newTotal: parseFloat((orderTotal - discountAmount).toFixed(2)),
      code: discount.code,
    });

  } catch (error: any) {
    console.error("Validate discount error:", error);
    return NextResponse.json({ error: "Failed to validate discount" }, { status: 500 });
  }
}