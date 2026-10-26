import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  code: z.string().trim().min(1).max(80),
  cartItemIds: z.array(z.string().min(1)).min(1).max(50),
}).strict();

function toCents(value: { toNumber(): number } | number): number {
  const amount = typeof value === "number" ? value : value.toNumber();

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid monetary value.");
  }

  return Math.round(amount * 100);
}

function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in to apply a discount code." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a valid discount code and selected cart items." },
        { status: 400 }
      );
    }

    const code = parsed.data.code.toUpperCase();
    const cartItemIds = parsed.data.cartItemIds;

    if (new Set(cartItemIds).size !== cartItemIds.length) {
      return NextResponse.json(
        { error: "Duplicate cart items are not allowed." },
        { status: 400 }
      );
    }

    const [discount, cartItems] = await Promise.all([
      db.discountCode.findUnique({
        where: { code },
      }),
      db.cartItem.findMany({
        where: {
          id: { in: cartItemIds },
          isSelected: true,
          cart: { userId },
        },
        include: {
          offer: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!discount || !discount.isActive) {
      return NextResponse.json(
        { error: "This discount code is invalid or inactive." },
        { status: 400 }
      );
    }

    const now = new Date();

    if (discount.startsAt > now) {
      return NextResponse.json(
        { error: "This discount code is not active yet." },
        { status: 400 }
      );
    }

    if (discount.expiresAt && discount.expiresAt <= now) {
      return NextResponse.json(
        { error: "This discount code has expired." },
        { status: 400 }
      );
    }

    if (
      discount.usageLimit !== null &&
      discount.usedCount >= discount.usageLimit
    ) {
      return NextResponse.json(
        { error: "This discount code has reached its usage limit." },
        { status: 400 }
      );
    }

    if (
      cartItems.length !== cartItemIds.length ||
      cartItems.some(
        (item) =>
          !item.offer ||
          item.offer.status !== "ACTIVE" ||
          item.offer.stockQuantity < item.quantity ||
          !item.offer.variant.isActive ||
          item.offer.variant.product.status !== "ACTIVE" ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1
      )
    ) {
      return NextResponse.json(
        { error: "Some selected cart items are unavailable. Refresh your cart and try again." },
        { status: 400 }
      );
    }

    const eligibleItems = cartItems.filter(
      (item) => item.offer!.sellerId === discount.sellerId
    );

    if (eligibleItems.length === 0) {
      return NextResponse.json(
        { error: "This discount code does not apply to the selected items." },
        { status: 400 }
      );
    }

    const eligibleSubtotalCents = eligibleItems.reduce(
      (total, item) => {
        const lineCents = toCents(item.offer!.price) * item.quantity;

        if (!Number.isSafeInteger(lineCents) ||
            !Number.isSafeInteger(total + lineCents)) {
          throw new Error("Cart subtotal exceeds the supported amount.");
        }

        return total + lineCents;
      },
      0
    );

    if (
      discount.minOrderAmount !== null &&
      eligibleSubtotalCents < toCents(discount.minOrderAmount)
    ) {
      return NextResponse.json(
        { error: "Your eligible items do not meet the minimum order amount for this code." },
        { status: 400 }
      );
    }

    const value = Number(discount.value);

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { error: "This discount code is incorrectly configured." },
        { status: 400 }
      );
    }

    let discountCents: number;

    if (discount.type === "PERCENTAGE") {
      if (value > 100) {
        return NextResponse.json(
          { error: "This discount code is incorrectly configured." },
          { status: 400 }
        );
      }

      discountCents = Math.round((eligibleSubtotalCents * value) / 100);
    } else {
      discountCents = Math.min(
        eligibleSubtotalCents,
        toCents(discount.value)
      );
    }

    if (discount.maxDiscount !== null) {
      discountCents = Math.min(
        discountCents,
        toCents(discount.maxDiscount)
      );
    }

    discountCents = Math.min(
      discountCents,
      eligibleSubtotalCents
    );

    if (discountCents <= 0) {
      return NextResponse.json(
        { error: "This discount code does not provide a discount for the selected items." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      discountId: discount.id,
      discountAmount: centsToAmount(discountCents),
      eligibleSubtotal: centsToAmount(eligibleSubtotalCents),
      code: discount.code,
    });
  } catch (error: unknown) {
    console.error("Validate discount error:", error);

    return NextResponse.json(
      { error: "Failed to validate the discount code. Please try again." },
      { status: 500 }
    );
  }
}
