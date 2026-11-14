 import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { extractBudget, isWithinBudget } from "@/lib/concierge-ranking";
import {
  generateComparisonAnalysis,
  resolveComparisonProducts,
} from "@/lib/concierge-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let productIds = body?.productIds;
    let comparisonCriteria: string[] = [];

    // Natural-language product discovery
    if (typeof body?.message === "string") {
      const message = body.message.trim();
      const budget = extractBudget(message);

      if (!message || message.length > 1000) {
        return NextResponse.json(
          { error: "Enter a valid comparison request." },
          { status: 400 }
        );
      }

      const stopWords = new Set([
        "compare", "between", "with", "and", "the", "for",
        "find", "best", "show", "me", "please", "want",
        "would", "like", "products", "product", "based",
        "on", "under", "below", "above", "around", "gh",
        "ghc",
      ]);

const normalizedMessage = message.toLowerCase();

const criteriaWords = new Set([
  "performance",
  "battery",
  "life",
  "camera",
  "price",
  "quality",
  "durability",
  "speed",
  "display",
  "screen",
  "storage",
  "memory",
  "ram",
  "processor",
  "portability",
  "design",
]);

const words: string[] =
  normalizedMessage.match(/[a-z0-9]+/g) ?? [];

const terms: string[] = [...new Set<string>(words)].filter(
  (word) =>
    word.length > 1 &&
    !stopWords.has(word) &&
    !criteriaWords.has(word) &&
    !/^\d+$/.test(word)
);

      if (terms.length === 0) {
        return NextResponse.json({
          products: [],
          clarification:
            "Please specify the products or category you want to compare.",
        });
      }

           const candidates = await db.product.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          description: true,
          attributes: true,
          semanticTags: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          variants: {
            where: { isActive: true },
            select: {
              sellerOffers: {
                where: {
                  status: "ACTIVE",
                  stockQuantity: { gt: 0 },
                  seller: { isActive: true },
                },
                select: {
                  price: true,
                  stockQuantity: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const searchableText = (value: unknown): string => {
        if (value === null || value === undefined) return "";

        if (typeof value === "string") return value.toLowerCase();

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value).toLowerCase();
        }

        if (Array.isArray(value)) {
          return value.map(searchableText).join(" ");
        }

        if (typeof value === "object") {
          return Object.entries(value as Record<string, unknown>)
            .map(([key, item]) => `${key} ${searchableText(item)}`)
            .join(" ");
        }

        return "";
      };

      const rankedCandidates = candidates
        .map((product) => {
          const title = product.title.toLowerCase();
          const description = product.description.toLowerCase();
          const category = product.category.name.toLowerCase();
          const tags = searchableText(product.semanticTags);
          const attributes = searchableText(product.attributes);

          let score = 0;

          for (const term of terms) {
            if (title.includes(term)) score += 12;
            if (category.includes(term)) score += 9;
            if (tags.includes(term)) score += 7;
            if (attributes.includes(term)) score += 6;
            if (description.includes(term)) score += 3;
          }

          return { product, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map((item) => item.product);

      const eligibleCandidates = rankedCandidates.filter((product) => {
        const offers = product.variants.flatMap((variant) =>
          variant.sellerOffers.map((offer) => ({
            price: Number(offer.price),
          }))
        );

        if (budget.minPrice === null && budget.maxPrice === null) {
          return true;
        }

        return offers.some((offer) => isWithinBudget(offer.price, budget));
      });
      if (eligibleCandidates.length < 2) {
        return NextResponse.json({
          products: [],
          clarification:
            "I couldn't find enough matching products. Try different product names or a broader category.",
        });
      }
      const resolved = await resolveComparisonProducts({
        message,
        candidates: eligibleCandidates.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          attributes: product.attributes,
          semanticTags: product.semanticTags,
          category: product.category,
          offers: product.variants.flatMap((variant) =>
            variant.sellerOffers.map((offer) => ({
              price: Number(offer.price),
              stockQuantity: offer.stockQuantity,
            }))
          ),
        })),
      });

      if (resolved.productIds.length < 2) {
        return NextResponse.json({
          products: [],
          criteria: resolved.criteria,
          clarification:
            resolved.clarification ??
            "I couldn't confidently identify at least two matching products. Could you be more specific?",
        });
      }

      productIds = resolved.productIds;
      comparisonCriteria = resolved.criteria;
    }
  
    // Validate selected product IDs
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

    const uniqueIds: string[] = [
      ...new Set<string>(
        productIds.map((id: string) => id.trim())
      ),
    ];

    if (uniqueIds.length < 2) {
      return NextResponse.json(
        { error: "Select at least 2 different products." },
        { status: 400 }
      );
    }

    // Load complete comparison data
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
            const difference =
              Number(a.offer.price) - Number(b.offer.price);

            return difference !== 0
              ? difference
              : a.offer.createdAt.getTime() -
                  b.offer.createdAt.getTime();
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
          criteria: comparisonCriteria,
          analysis: null,
          analysisError:
            "At least 2 active products are required for analysis.",
        });
      }

      try {
        const analysis = await generateComparisonAnalysis({
          products,
        });

        return NextResponse.json({
          products,
          criteria: comparisonCriteria,
          analysis,
          analysisError: null,
        });
      } catch (error) {
        console.error("AI comparison analysis error:", error);

        return NextResponse.json({
          products,
          criteria: comparisonCriteria,
          analysis: null,
          analysisError:
            "AI analysis is temporarily unavailable. You can still compare the products below.",
        });
      }
    }

    return NextResponse.json({
      products,
      criteria: comparisonCriteria,
    });
  } catch (error) {
    console.error("Compare API error:", error);

    return NextResponse.json(
      { error: "Failed to fetch comparison data." },
      { status: 500 }
    );
  }
}