 import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateComparisonAnalysis } from "@/lib/concierge-ai";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productIds = body?.productIds;

    if (
      !Array.isArray(productIds) ||
      productIds.length < 2 ||
      productIds.length > 4 ||
      !productIds.every(
        (id: unknown) => typeof id === "string" && id.trim().length > 0
      )
    ) {
      return NextResponse.json(
        { error: "Provide between 2 and 4 valid product IDs." },
        { status: 400 }
      );
    }

    const uniqueIds = [...new Set(
      productIds.map((id: string) => id.trim())
    )];

    if (uniqueIds.length < 2) {
      return NextResponse.json(
        { error: "Select at least 2 different products." },
        { status: 400 }
      );
    }

    const records = await db.product.findMany({
      where: {
        id: { in: uniqueIds },
        status: "ACTIVE",
      },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            sellerOffers: {
              where: {
                status: "ACTIVE",
                stockQuantity: { gt: 0 },
                seller: { isActive: true },
              },
              include: {
                seller: {
                  select: {
                    id: true,
                    businessName: true,
                    logoUrl: true,
                    verificationStatus: true,
                    trustMetric: {
                      select: {
                        overallTrustScore: true,
                        averageRating: true,
                        fulfillmentRate: true,
                        returnRate: true,
                        totalOrders: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    const productMap = new Map(
      records.map((product) => {
        const offers = product.variants
          .flatMap((variant) =>
            variant.sellerOffers.map((offer) => ({
              offer,
              variant,
            }))
          )
          .sort((a, b) => {
            const priceDifference =
              Number(a.offer.price) - Number(b.offer.price);

            return priceDifference !== 0
              ? priceDifference
              : a.offer.createdAt.getTime() - b.offer.createdAt.getTime();
          });

        const best = offers[0];

        const avgRating =
          product.reviews.length > 0
            ? product.reviews.reduce(
                (sum, review) => sum + review.rating,
                0
              ) / product.reviews.length
            : null;

        const seller = best?.offer.seller;
        const trust = seller?.trustMetric;

        return [
          product.id,
          {
            id: product.id,
            title: product.title,
            slug: product.slug,
            description: product.description,
            imageUrl: product.images[0]?.url ?? null,

            price: best ? Number(best.offer.price) : null,

            compareAtPrice: best?.variant.compareAtPrice
              ? Number(best.variant.compareAtPrice)
              : null,

            stockQuantity: best?.offer.stockQuantity ?? 0,

            bestOfferId: best?.offer.id ?? null,
            bestVariantId: best?.variant.id ?? null,

            attributes: product.attributes ?? {},

            sellerName: seller?.businessName ?? null,
            sellerLogoUrl: seller?.logoUrl ?? null,
            sellerId: seller?.id ?? null,

            sellerVerified:
              seller?.verificationStatus === "VERIFIED",

            sellerTrustScore: trust
              ? Number(trust.overallTrustScore)
              : null,

            sellerRating: trust
              ? Number(trust.averageRating)
              : null,

            sellerFulfillmentRate: trust
              ? Number(trust.fulfillmentRate)
              : null,

            sellerReturnRate: trust
              ? Number(trust.returnRate)
              : null,

            sellerTotalOrders: trust?.totalOrders ?? 0,

            categoryName: product.category.name,
            categorySlug: product.category.slug,

            avgRating:
              avgRating === null
                ? null
                : Math.round(avgRating * 10) / 10,

            reviewCount: product.reviews.length,
            createdAt: product.createdAt,
          },
        ] as const;
      })
    );

    const products = uniqueIds
      .map((id) => productMap.get(id))
      .filter((product) => product !== undefined);

 if (body?.includeAnalysis === true) {
  if (products.length < 2) {
    return NextResponse.json({
      products,
      analysis: null,
      analysisError: "At least 2 active products are required for analysis.",
    });
  }

  try {
    const analysis = await generateComparisonAnalysis({
      products,
    });

    return NextResponse.json({
      products,
      analysis,
      analysisError: null,
    });
  } catch (error) {
    console.error("AI comparison analysis error:", error);

    return NextResponse.json({
      products,
      analysis: null,
      analysisError: "AI analysis is temporarily unavailable. You can still compare the products below.",
    });
  }
}

return NextResponse.json({ products });
  } catch (error) {
    console.error("Compare API error:", error);

    return NextResponse.json(
      { error: "Failed to fetch comparison data." },
      { status: 500 }
    );
  }
}