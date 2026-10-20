// src/app/api/compare/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { productIds } = await req.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Product IDs required" }, { status: 400 });
    }

    if (productIds.length > 4) {
      return NextResponse.json({ error: "Maximum 4 products" }, { status: 400 });
    }

    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
      },
      include: {
        variants: true,
        images: { where: { isPrimary: true }, take: 1 },
        seller: { 
          select: { 
            businessName: true,
            verificationStatus: true,
            trustMetric: {
              select: {
                overallTrustScore: true,
                averageRating: true,
              }
            }
          } 
        },
        category: { select: { name: true, slug: true } },
        reviews: {
          select: { rating: true },
        },
      },
    });

    const comparisonData = products.map((p) => {
      const variant = p.variants[0];
      const avgRating = p.reviews.length > 0
        ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
        : null;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        imageUrl: p.images[0]?.url || null,
        price: variant?.price ? parseFloat(variant.price.toString()) : 0,
        compareAtPrice: variant?.compareAtPrice ? parseFloat(variant.compareAtPrice.toString()) : null,
        stockQuantity: variant?.stockQuantity || 0,
        attributes: p.attributes || {},
        sellerName: p.seller?.businessName || "Unknown",
        sellerVerified: p.seller?.verificationStatus === "VERIFIED",
        sellerTrustScore: p.seller?.trustMetric?.overallTrustScore 
          ? parseFloat(p.seller.trustMetric.overallTrustScore.toString()) 
          : null,
        sellerRating: p.seller?.trustMetric?.averageRating 
          ? parseFloat(p.seller.trustMetric.averageRating.toString()) 
          : null,
        categoryName: p.category.name,
        categorySlug: p.category.slug,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        reviewCount: p.reviews.length,
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json({ products: comparisonData });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json({ error: "Failed to fetch comparison data" }, { status: 500 });
  }
}