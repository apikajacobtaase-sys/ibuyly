// src/app/api/cart/merge/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const MergeCartSchema = z.object({
  guestCart: z.array(
    z.object({
      productId: z.string().cuid(),
      variantId: z.string().cuid(),
      quantity: z.number().int().positive(),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = MergeCartSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid cart data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { guestCart } = validation.data;

    if (guestCart.length === 0) {
      return NextResponse.json({ success: true, merged: false, message: "Guest cart is empty" });
    }

    // Get user's existing cart
    let userCart = await db.cart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // Create cart if it doesn't exist
    if (!userCart) {
      userCart = await db.cart.create({
        data: {
          userId: session.user.id,
          items: { create: [] },
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });
    }

    // Merge logic
    const mergedItems: Array<{
      variantId: string;
      quantity: number;
    }> = [];

    for (const guestItem of guestCart) {
      // Check if product/variant exists and is active
      const variant = await db.productVariant.findUnique({
        where: { id: guestItem.variantId },
        include: { product: true },
      });

      if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
        continue; // Skip unavailable items
      }

      // Check if item already exists in user's cart
      const existingItem = userCart.items.find(
        (item) => item.variantId === guestItem.variantId
      );

      if (existingItem) {
        // Combine quantities, but cap at stock
        const combinedQty = existingItem.quantity + guestItem.quantity;
        const finalQty = Math.min(combinedQty, variant.stockQuantity);
        
        if (finalQty > 0) {
          mergedItems.push({
            variantId: guestItem.variantId,
            quantity: finalQty,
          });
        }
      } else {
        // Add new item, capped at stock
        const finalQty = Math.min(guestItem.quantity, variant.stockQuantity);
        if (finalQty > 0) {
          mergedItems.push({
            variantId: guestItem.variantId,
            quantity: finalQty,
          });
        }
      }
    }

    // Update cart items atomically
    await db.$transaction(async (tx) => {
      // Delete existing items
      await tx.cartItem.deleteMany({
        where: { cartId: userCart!.id },
      });

      // Create merged items
      if (mergedItems.length > 0) {
        await tx.cartItem.createMany({
          data: mergedItems.map((item) => ({
            cartId: userCart!.id,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        });
      }
    });

    return NextResponse.json({
      success: true,
      merged: true,
      itemCount: mergedItems.length,
      message: `Cart merged successfully. ${mergedItems.length} item${mergedItems.length !== 1 ? "s" : ""} in your cart.`,
    });
  } catch (error: any) {
    console.error("Cart merge error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge cart" },
      { status: 500 }
    );
  }
}