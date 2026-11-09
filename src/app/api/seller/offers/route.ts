// src/app/api/seller/offers/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const CreateOfferSchema = z.object({
  variantId: z.string().cuid(),
  price: z.coerce.number().finite().positive(),
  stockQuantity: z.coerce.number().int().min(0),
  condition: z.string().trim().min(1).max(50),
  sellerSku: z.string().trim().max(100).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    if (!["all", "low_stock", "out_of_stock"].includes(filter)) {
      return NextResponse.json(
        { error: "Invalid offer filter" },
        { status: 400 }
      );
    }

    const offers = await db.sellerOffer.findMany({
      where: {
        sellerId: access.sellerId,
      },
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
      orderBy: {
        updatedAt: "desc",
      },
    });

    const formattedOffers = offers
      .map((offer) => {
        const offerStock = offer.stockQuantity;

        let show = true;

        if (filter === "low_stock") {
          show = offerStock > 0 && offerStock <= 10;
        }

        if (filter === "out_of_stock") {
          show = offerStock === 0;
        }

        return {
          ...offer,
          stockQuantity: offerStock,
          show,
        };
      })
      .filter((offer) => offer.show);

    return NextResponse.json({
      offers: formattedOffers,
    });
  } catch (error) {
    console.error("Fetch offers error:", error);

    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    // Creating an offer also changes its stock quantity.
    const inventoryAccess = await authorizeSeller(
      "manage_inventory",
      access.sellerId
    );

    if (!inventoryAccess.authorized) {
      return inventoryAccess.response;
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const validation = CreateOfferSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid offer details",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      variantId,
      price,
      stockQuantity,
      condition,
      sellerSku,
    } = validation.data;

    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "Catalogue variant not found" },
        { status: 404 }
      );
    }

    await db.sellerOffer.upsert({
      where: {
        sellerId_variantId: {
          sellerId: access.sellerId,
          variantId,
        },
      },
      update: {
        price,
        stockQuantity,
        condition,
        sellerSku: sellerSku || null,
        status: stockQuantity > 0 ? "ACTIVE" : "OUT_OF_STOCK",
      },
      create: {
        sellerId: access.sellerId,
        variantId,
        price,
        stockQuantity,
        condition,
        sellerSku: sellerSku || null,
        status: stockQuantity > 0 ? "ACTIVE" : "OUT_OF_STOCK",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stock added successfully",
    });
  } catch (error) {
    console.error("Create offer error:", error);

    return NextResponse.json(
      { error: "Failed to add stock" },
      { status: 500 }
    );
  }
}