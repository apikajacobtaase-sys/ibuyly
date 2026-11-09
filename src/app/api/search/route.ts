import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const productInclude = {
  images: {
    where: { isPrimary: true },
    take: 1,
  },
  seller: {
    select: {
      businessName: true,
      id: true,
    },
  },
  variants: {
    where: { isActive: true },
    include: {
      sellerOffers: {
        where: {
          status: "ACTIVE",
          stockQuantity: { gt: 0 },
        },
        include: {
          seller: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
  },
} satisfies Prisma.ProductInclude;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...(query.trim()
        ? {
            OR: [
              {
                title: {
                  contains: query.trim(),
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: productInclude,
      }),
      db.product.count({
        where: whereClause,
      }),
    ]);

    const formattedProducts = products.map((product) => {
      let bestOffer: (typeof product.variants)[number]["sellerOffers"][number] | null = null;
      let bestVariantId: string | null = null;
      let compareAtPrice: number | null = null;

      for (const variant of product.variants) {
        const offer = variant.sellerOffers[0];

        if (
          offer &&
          (!bestOffer || Number(offer.price) < Number(bestOffer.price))
        ) {
          bestOffer = offer;
          bestVariantId = variant.id;
          compareAtPrice = variant.compareAtPrice
            ? Number(variant.compareAtPrice)
            : null;
        }
      }

      const currentPrice = bestOffer ? Number(bestOffer.price) : null;

      const discountPercent =
        currentPrice !== null &&
        compareAtPrice !== null &&
        compareAtPrice > currentPrice
          ? Math.round(
              ((compareAtPrice - currentPrice) / compareAtPrice) * 100
            )
          : 0;

      return {
        id: product.id,
        title: product.title || "Untitled Product",
        slug: product.slug || "",
        price: currentPrice,
        originalPrice: compareAtPrice,
        discountPercent,
        stockQuantity: bestOffer?.stockQuantity ?? 0,
        bestOfferId: bestOffer?.id ?? null,
        bestVariantId,
        imageUrl: product.images[0]?.url ?? null,
        sellerName:
          bestOffer?.seller.businessName ??
          product.seller?.businessName ??
          "iBUY Marketplace",
        sellerId: bestOffer?.seller.id ?? product.sellerId ?? "unknown",
        inStock: Boolean(bestOffer),
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      total,
      page,
      hasMore: total > skip + limit,
    });
  } catch (error) {
    console.error("Search API Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
