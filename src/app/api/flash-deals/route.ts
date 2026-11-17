 import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    const deals = await db.flashDeal.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
        offer: {
          status: "ACTIVE",
          stockQuantity: { gt: 0 },
          seller: {
            isActive: true,
          },
          variant: {
            isActive: true,
            product: {
              status: "ACTIVE",
            },
          },
        },
      },
      include: {
        offer: {
          include: {
            seller: {
              select: {
                id: true,
                businessName: true,
                logoUrl: true,
              },
            },
            variant: {
              include: {
                product: {
                  include: {
                    images: {
                      orderBy: [
                        { isPrimary: "desc" },
                        { sortOrder: "asc" },
                      ],
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        endsAt: "asc",
      },
      take: 50,
    });

    const availableDeals = deals
      .map((deal) => {
        const remainingQuantity =
          deal.dealQuantity -
          deal.soldQuantity -
          deal.reservedQuantity;

        const stockQuantity = Math.min(
          remainingQuantity,
          deal.offer.stockQuantity
        );

        const promotionalPrice = Number(deal.promotionalPrice);
        const originalPrice = Number(deal.offer.price);

        if (
          remainingQuantity <= 0 ||
          stockQuantity <= 0 ||
          promotionalPrice <= 0 ||
          promotionalPrice >= originalPrice
        ) {
          return null;
        }

        const product = deal.offer.variant.product;

        return {
          id: deal.id,
          offerId: deal.offer.id,
          variantId: deal.offer.variant.id,
          productId: product.id,
          title: product.title,
          slug: product.slug,
          imageUrl: product.images[0]?.url ?? null,
          price: promotionalPrice,
          originalPrice,
          discountPercent: Math.round(
            ((originalPrice - promotionalPrice) / originalPrice) * 100
          ),
          stockQuantity,
          sellerId: deal.offer.seller.id,
          sellerName: deal.offer.seller.businessName,
          sellerLogoUrl: deal.offer.seller.logoUrl,
          startsAt: deal.startsAt,
          endsAt: deal.endsAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      { deals: availableDeals },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Flash Deals API error:", error);

    return NextResponse.json(
      { error: "Failed to fetch flash deals." },
      { status: 500 }
    );
  }
}