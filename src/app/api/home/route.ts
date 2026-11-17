 // src/app/api/home/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const availableProductWhere = {
  status: "ACTIVE" as const,
  variants: {
    some: {
      isActive: true,
      sellerOffers: {
        some: {
          status: "ACTIVE" as const,
          stockQuantity: { gt: 0 },
        },
      },
    },
  },
};

const availableCategoryWhere = {
  OR: [
    {
      products: {
        some: availableProductWhere,
      },
    },
    {
      children: {
        some: {
          isActive: true,
          products: {
            some: availableProductWhere,
          },
        },
      },
    },
  ],
};

export async function GET() {
  try {
    // 1. Fetch only categories with available products
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        ...availableCategoryWhere,
      },
      take: 6,
      orderBy: { id: "asc" },
    });

    // 2. Fetch Flash Sale products
    const flashSaleProducts = await db.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        variants: { take: 1 },
        images: { where: { isPrimary: true }, take: 1 },
        seller: { select: { businessName: true } },
      },
      take: 4,
      orderBy: { createdAt: "desc" },
    });

    // 3. Fetch Recommended products
    const recommendedProducts = await db.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        variants: { take: 1 },
        images: { where: { isPrimary: true }, take: 1 },
        seller: { select: { businessName: true } },
        reviews: { select: { rating: true } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      categories,

      flashSaleProducts: flashSaleProducts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: p.variants[0]?.price || 0,
        compareAtPrice: p.variants[0]?.compareAtPrice,
        imageUrl: p.images[0]?.url || null,
        sellerName: p.seller?.businessName,
        stockQuantity: p.variants[0]?.stockQuantity || 0,
      })),

      recommendedProducts: recommendedProducts.map((p) => {
        const variant = p.variants[0];

        const avgRating =
          p.reviews.length > 0
            ? Math.round(
                (p.reviews.reduce((sum, r) => sum + r.rating, 0) /
                  p.reviews.length) *
                  10
              ) / 10
            : null;

        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          price: variant?.price
            ? parseFloat(variant.price.toString())
            : 0,
          compareAtPrice: variant?.compareAtPrice
            ? parseFloat(variant.compareAtPrice.toString())
            : null,
          imageUrl: p.images[0]?.url || null,
          sellerName: p.seller?.businessName,
          stockQuantity: variant?.stockQuantity || 0,
          avgRating,
          reviewCount: p.reviews.length,
        };
      }),
    });
  } catch (error) {
    console.error("Homepage API error:", error);

    return NextResponse.json(
      { error: "Failed to fetch homepage data" },
      { status: 500 }
    );
  }
}