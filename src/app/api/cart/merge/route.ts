
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
      offerId: z.string().cuid(),
      quantity: z.number().int().positive().max(100),
    })
  ).max(200),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = MergeCartSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid cart data",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { guestCart } = validation.data;

    if (guestCart.length === 0) {
      return NextResponse.json({
        success: true,
        merged: false,
        itemCount: 0,
        skippedCount: 0,
        message: "Guest cart is empty",
      });
    }

    // Combine duplicate entries for the same seller offer.
    const groupedItems = new Map<
      string,
      {
        productId: string;
        variantId: string;
        offerId: string;
        quantity: number;
      }
    >();

    for (const item of guestCart) {
      const key = `${item.offerId}:${item.variantId}`;
      const existing = groupedItems.get(key);

      if (existing) {
        existing.quantity = Math.min(
          existing.quantity + item.quantity,
          100
        );
      } else {
        groupedItems.set(key, { ...item });
      }
    }

    const itemsToMerge = [...groupedItems.values()];

    const result = await db.$transaction(
      async (tx) => {
        let userCart = await tx.cart.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        });

        if (!userCart) {
          userCart = await tx.cart.create({
            data: { userId: session.user.id },
            select: { id: true },
          });
        }

        const offerIds = [
          ...new Set(itemsToMerge.map((item) => item.offerId)),
        ];

        const variantIds = [
          ...new Set(itemsToMerge.map((item) => item.variantId)),
        ];

        // Fetch all relevant offers in one database query.
        const offers = await tx.sellerOffer.findMany({
          where: {
            id: { in: offerIds },
          },
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    status: true,
                  },
                },
              },
            },
          },
        });

        const offerById = new Map(
          offers.map((offer) => [offer.id, offer])
        );

        // Fetch existing cart entries in one query.
        const existingItems = await tx.cartItem.findMany({
          where: {
            cartId: userCart.id,
            variantId: { in: variantIds },
          },
        });

        const existingByKey = new Map(
          existingItems.map((item) => [
            `${item.offerId}:${item.variantId}`,
            item,
          ])
        );

        let mergedCount = 0;
        let skippedCount = 0;

        for (const guestItem of itemsToMerge) {
          const offer = offerById.get(guestItem.offerId);

          // Validate the exact product, variant and seller offer.
          if (
            !offer ||
            offer.variantId !== guestItem.variantId ||
            offer.variant.productId !== guestItem.productId ||
            offer.status !== "ACTIVE" ||
            !offer.variant.isActive ||
            offer.variant.product.status !== "ACTIVE" ||
            offer.stockQuantity <= 0
          ) {
            skippedCount++;
            continue;
          }

          const key = `${guestItem.offerId}:${guestItem.variantId}`;
          const existingItem = existingByKey.get(key);

          const finalQuantity = Math.min(
            (existingItem?.quantity ?? 0) + guestItem.quantity,
            offer.stockQuantity
          );

          if (finalQuantity <= 0) {
            skippedCount++;
            continue;
          }

          if (existingItem) {
            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: finalQuantity,
                isSelected: true,
              },
            });
          } else {
            const createdItem = await tx.cartItem.create({
              data: {
                cartId: userCart.id,
                variantId: guestItem.variantId,
                offerId: guestItem.offerId,
                quantity: finalQuantity,
                isSelected: true,
              },
            });

            // Keep the in-memory map in sync with writes.
            existingByKey.set(key, createdItem);
          }

          mergedCount++;
        }

        return {
          mergedCount,
          skippedCount,
        };
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    return NextResponse.json({
      success: true,
      merged: result.mergedCount > 0,
      itemCount: result.mergedCount,
      skippedCount: result.skippedCount,
      message: "Cart merge completed.",
    });
  } catch (error) {
    console.error("Cart merge error:", error);

    return NextResponse.json(
      { error: "Failed to merge cart" },
      { status: 500 }
    );
  }
}