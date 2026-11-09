import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const updateSchema = z.object({
  offerId: z.string().min(1),
  stockQuantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  price: z.number().finite().positive().optional(),
  status: z.enum(["ACTIVE", "OUT_OF_STOCK"]).optional(),
}).refine(
  (data) =>
    data.stockQuantity !== undefined ||
    data.price !== undefined ||
    data.status !== undefined,
  { message: "At least one field must be provided" }
);

export async function GET() {
  try {
    const access = await authorizeSeller("manage_inventory");

    if (!access.authorized) return access.response;

    const offers = await db.sellerOffer.findMany({
      where: { sellerId: access.sellerId },
      include: {
        variant: {
          include: {
            product: {
              select: {
                title: true,
                slug: true,
                images: {
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const inventory = offers.map((offer) => {
      const displayStock = offer.stockQuantity;
      const threshold = offer.variant.lowStockThreshold ?? 5;

      const stockStatus =
        displayStock === 0
          ? "OUT_OF_STOCK"
          : displayStock <= threshold
            ? "LOW_STOCK"
            : "IN_STOCK";

      return {
        offerId: offer.id,
        variantId: offer.variantId,
        productTitle: offer.variant.product.title,
        productSlug: offer.variant.product.slug,
        imageUrl: offer.variant.product.images[0]?.url || null,
        sku: offer.variant.sku,
        sellerSku: offer.sellerSku,
        price: Number(offer.price),
        stockQuantity: displayStock,
        lowStockThreshold: threshold,
        stockStatus,
      };
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Fetch inventory error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await authorizeSeller("manage_inventory");

    if (!access.authorized) return access.response;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid inventory update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { offerId, stockQuantity, price, status } = parsed.data;

    if (price !== undefined) {
      const productAccess = await authorizeSeller(
        "manage_products",
        access.sellerId
      );

      if (!productAccess.authorized) {
        return productAccess.response;
      }
    }

    const offer = await db.sellerOffer.findFirst({
      where: {
        id: offerId,
        sellerId: access.sellerId,
      },
      select: {
        id: true,
        stockQuantity: true,
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const nextStock = stockQuantity ?? offer.stockQuantity;

    if (status === "ACTIVE" && nextStock === 0) {
      return NextResponse.json(
        { error: "An item with zero stock cannot be activated" },
        { status: 400 }
      );
    }

    const nextStatus =
      status ??
      (stockQuantity !== undefined
        ? stockQuantity === 0
          ? "OUT_OF_STOCK"
          : undefined
        : undefined);

    const updated = await db.sellerOffer.updateMany({
      where: {
        id: offer.id,
        sellerId: access.sellerId,
      },
      data: {
        ...(stockQuantity !== undefined && { stockQuantity }),
        ...(price !== undefined && { price }),
        ...(nextStatus !== undefined && { status: nextStatus }),
      },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Inventory item could not be updated" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Inventory updated successfully",
    });
  } catch (error) {
    console.error("Update inventory error:", error);
    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 }
    );
  }
}