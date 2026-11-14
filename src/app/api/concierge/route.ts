 import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  hasBudgetMatchingOffer,
  isWithinBudget,
  prioritizeOffers,
  resolveBudget,
} from "@/lib/concierge-ranking";

import { generateConciergeResponse } from "@/lib/concierge-ai";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

type ShoppingIntent = {
  category: string | null;
  keywords: string[];
  maxPrice: number | null;
  minPrice: number | null;
  originalMessage: string;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from",
  "have", "want", "need", "looking", "buy", "get", "show",
  "please", "help", "find", "under", "below", "above",
  "between", "less", "than", "more", "maximum", "minimum",
  "price", "budget", "cedis", "cedi", "ghs", "ghc",
  "ghana", "give", "me", "some", "any", "good", "best",
  "can", "you", "recommend", "recommendation", "something",
  "like", "also", "what", "which", "would", "could",
  "its", "it", "a", "an", "of", "to", "in", "on",
]);

const SYNONYMS: Record<string, string[]> = {
  phone: ["smartphone", "mobile", "cellphone", "handset"],
  smartphone: ["phone", "mobile", "cellphone"],
  laptop: ["notebook", "computer", "pc"],
  computer: ["laptop", "desktop", "pc"],
  television: ["tv", "smart tv", "screen"],
  tv: ["television", "smart tv"],
  refrigerator: ["fridge", "freezer"],
  fridge: ["refrigerator", "freezer"],
  footwear: ["shoes", "sneakers", "slippers"],
  shoes: ["footwear", "sneakers", "boots"],
  sneakers: ["shoes", "trainers", "footwear"],
  headphones: ["earphones", "headset", "earbuds"],
  earphones: ["headphones", "earbuds"],
  camera: ["photography", "digital camera"],
  gaming: ["games", "console", "playstation", "xbox"],
  furniture: ["chair", "table", "desk", "sofa"],
  backpack: ["bag", "school bag"],
  bag: ["backpack", "handbag"],
};

function expandKeywords(words: string[]) {
  const expanded = new Set<string>();

  for (const word of words) {
    expanded.add(word);

    for (const synonym of SYNONYMS[word] ?? []) {
      expanded.add(synonym);
    }
  }

  return [...expanded];
}

function extractKeywords(message: string) {
  return [
    ...new Set(
      message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !STOP_WORDS.has(word) &&
            !/^\d+$/.test(word)
        )
    ),
  ];
}

function detectComparisonIntent(message: string) {
  return /\b(compare|comparison|versus|vs\.?|difference|differences|which seller|better seller)\b/i.test(
    message
  );
}

function detectPurchaseIntent(message: string) {
  return /\b(i want to buy|i would like to buy|i intend to buy|i'm buying|i am buying|ready to buy|place my order|proceed to checkout|purchase this|i'll take it|i will take it)\b/i.test(
    message
  );
}

function scoreProduct(
  product: {
    title: string;
    description: string;
    category: { name: string };
    semanticTags: unknown;
  },
  keywords: string[],
  preferredCategories: Set<string>,
  categoryId: string
) {
  const title = product.title.toLowerCase();
  const description = product.description.toLowerCase();
  const category = product.category.name.toLowerCase();

  const tags = Array.isArray(product.semanticTags)
    ? product.semanticTags.map(String).join(" ").toLowerCase()
    : typeof product.semanticTags === "object" &&
        product.semanticTags !== null
      ? JSON.stringify(product.semanticTags).toLowerCase()
      : "";

  let score = 0;

  for (const keyword of keywords) {
    if (title.includes(keyword)) score += 12;
    if (category.includes(keyword)) score += 9;
    if (tags.includes(keyword)) score += 7;
    if (description.includes(keyword)) score += 3;
  }

  if (preferredCategories.has(categoryId)) {
    score += 5;
  }

  return score;
}

export async function POST(req: Request) {
  try {
    const body = RequestSchema.safeParse(await req.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Please provide a valid shopping message." },
        { status: 400 }
      );
    }

    const { message, conversationHistory } = body.data;

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to use the shopping concierge." },
        { status: 401 }
      );
    }

    // Preserve the recent shopping conversation.
    const previousUserMessages = conversationHistory
      .filter((item) => item.role === "user")
      .slice(-4)
      .map((item) => item.content);

    const contextualMessage = [
      ...previousUserMessages,
      message,
    ].join(" ");

const budget = resolveBudget(message, previousUserMessages);


    const keywords = expandKeywords(
      extractKeywords(contextualMessage)
    );

    const intent: ShoppingIntent = {
      category: null,
      keywords,
      maxPrice: budget.maxPrice,
      minPrice: budget.minPrice,
      originalMessage: message,
    };

    // Retrieve the customer's actual shopping interests.
    const [wishlistItems, deliveredOrders, categories] =
      await Promise.all([
        db.wishlist.findMany({
          where: { userId: session.user.id },
          select: {
            product: {
              select: { categoryId: true },
            },
          },
        }),

        db.order.findMany({
          where: {
            userId: session.user.id,
            status: "DELIVERED",
          },
          select: {
            items: {
              select: {
                variant: {
                  select: {
                    product: {
                      select: { categoryId: true },
                    },
                  },
                },
              },
            },
          },
        }),

        db.category.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
      ]);

    const categoryScores = new Map<string, number>();

    for (const item of wishlistItems) {
      const id = item.product.categoryId;
      categoryScores.set(id, (categoryScores.get(id) ?? 0) + 3);
    }

    for (const order of deliveredOrders) {
      for (const item of order.items) {
        const id = item.variant.product.categoryId;

        categoryScores.set(id, (categoryScores.get(id) ?? 0) + 5);
      }
    }

    const preferredCategories = new Set(
      [...categoryScores.entries()]
        .filter(([, score]) => score >= 3)
        .map(([id]) => id)
    );

    // Infer the most relevant catalogue category.
    const normalizedMessage = contextualMessage.toLowerCase();

    const matchedCategory = categories
      .map((category) => ({
        ...category,
        score: category.name.toLowerCase()
          .split(/\s+/)
          .filter((word) => normalizedMessage.includes(word))
          .length,
      }))
      .filter((category) => category.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (matchedCategory) {
      intent.category = matchedCategory.name;
    }

    // Retrieve real products with all available active offers.
    const products = await db.product.findMany({
      where: {
  status: "ACTIVE",
  variants: {
          some: {
            isActive: true,
          sellerOffers: {
  some: {
    status: "ACTIVE",
    stockQuantity: { gt: 0 },
    seller: {
      isActive: true,
    },
  },
},
          },
        },
      },

      include: {
        variants: {
          where: {
            isActive: true,
            sellerOffers: {
              some: {
                status: "ACTIVE",
                stockQuantity: { gt: 0 },
                seller: {
  isActive: true,
},
              },
            },
          },
          include: {
           sellerOffers: {
  where: {
    status: "ACTIVE",
    stockQuantity: { gt: 0 },
    seller: {
      isActive: true,
    },
  },
  orderBy: { price: "asc" },
  include: {
    seller: {
      select: {
        id: true,
        businessName: true,
        trustMetric: {
          select: {
            overallTrustScore: true,
            fulfillmentRate: true,
            averageRating: true,
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
          orderBy: { sortOrder: "asc" },
        },

        category: {
          select: {
            name: true,
          },
        },
        reviews: {
  select: {
    rating: true,
    isVerified: true,
  },
},

      },
      take: 300,
      orderBy: { createdAt: "desc" },
    });

    // Rank products using relevance and customer preferences.
    // Intelligent weighted product recommendation engine.
const candidates = products
  .map((product) => {
    const availableOffers = product.variants.flatMap((variant) =>
      variant.sellerOffers.map((offer) => ({
        variant,
        offer,
      }))
    );

    if (availableOffers.length === 0) return null;

    const relevance = scoreProduct(
      product,
      keywords,
      preferredCategories,
      product.categoryId
    );

    // Bayesian review scoring prevents a single review
    // from disproportionately influencing recommendations.
    let weightedRatingSum = 0;
    let reviewWeight = 0;
    let verifiedReviewCount = 0;

    for (const review of product.reviews) {
      const weight = review.isVerified ? 1 : 0.5;

      weightedRatingSum += review.rating * weight;
      reviewWeight += weight;

      if (review.isVerified) verifiedReviewCount++;
    }

    const priorRating = 3.8;
    const priorWeight = 5;

    const averageRating =
      (weightedRatingSum + priorRating * priorWeight) /
      (reviewWeight + priorWeight);

    const ratingScore = (averageRating / 5) * 100;

    // Evaluate seller reliability for every available offer.
    const evaluatedOffers = availableOffers.map(({ variant, offer }) => {
      const trust = offer.seller.trustMetric;

      const sellerTrust = trust
        ? Number(trust.overallTrustScore)
        : 50;

      const fulfillmentRate = trust
        ? Number(trust.fulfillmentRate)
        : 50;

      const returnRate = trust
        ? Number(trust.returnRate)
        : 0;

      const normalizedTrust = Math.max(
        0,
        Math.min(100, sellerTrust)
      );

      const normalizedFulfillment = Math.max(
        0,
        Math.min(100, fulfillmentRate)
      );

      const normalizedReturnRate = Math.max(
        0,
        Math.min(100, returnRate)
      );

      const trustScore = normalizedTrust;

      const fulfillmentScore = normalizedFulfillment;

      const price = Number(offer.price);

      // Budget fit rewards affordability without automatically
      // treating the cheapest product as the best product.
      let budgetScore = 65;

const hasMinPrice =
  intent.minPrice !== null && intent.minPrice > 0;

const hasMaxPrice =
  intent.maxPrice !== null && intent.maxPrice > 0;

if (hasMinPrice && hasMaxPrice) {
  if (price >= intent.minPrice! && price <= intent.maxPrice!) {
    budgetScore = 100;
  } else {
    const distance =
      price < intent.minPrice!
        ? intent.minPrice! - price
        : price - intent.maxPrice!;

    const range = intent.maxPrice! - intent.minPrice!;

    budgetScore = Math.max(
      0,
      100 - (distance / Math.max(range, 1)) * 100
    );
  }
} else if (hasMaxPrice) {
  const ratio = price / intent.maxPrice!;

  budgetScore =
    ratio <= 1
      ? 100 - ratio * 25
      : Math.max(0, 75 - (ratio - 1) * 150);
} else if (hasMinPrice) {
  budgetScore =
    price >= intent.minPrice!
      ? 100
      : Math.max(0, (price / intent.minPrice!) * 100);
}
      // Prefer reliable sellers while considering affordability.
      const offerScore =
        trustScore * 0.65 +
        fulfillmentScore * 0.20 +
        budgetScore * 0.15;

      return {
        variant,
        offer,
        price,
        trustScore,
        fulfillmentScore,
        returnRate: normalizedReturnRate,
        budgetScore,
        offerScore,
      };
    });

  const prioritizedOffers = prioritizeOffers(evaluatedOffers, intent);

const bestOffer = prioritizedOffers[0];
    const sellerTrustScore = bestOffer.trustScore;
    const fulfillmentScore = bestOffer.fulfillmentScore;
    const budgetScore = bestOffer.budgetScore;

    const aiQualityScore = Math.max(
      0,
      Math.min(100, Number(product.aiQualityScore ?? 0))
    );

    return {
      product,
      availableOffers: prioritizedOffers,
      relevance,
      ratingScore,
      averageRating,
      reviewCount: product.reviews.length,
      verifiedReviewCount,
      sellerTrustScore,
      fulfillmentScore,
      budgetScore,
      aiQualityScore,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item !== null);
  const hasBudgetConstraint =
  intent.minPrice !== null || intent.maxPrice !== null;

const budgetMatchedCandidates = candidates.filter((item) =>
  hasBudgetMatchingOffer(item.availableOffers, intent)
);

// Prefer products that satisfy the budget.
// If none match, retain alternatives rather than returning nothing.
const recommendationCandidates =
  hasBudgetConstraint && budgetMatchedCandidates.length > 0
    ? budgetMatchedCandidates
    : candidates;

// Normalize relevance across retrieved products.
const maxRelevance = Math.max(
  1,
  ...recommendationCandidates.map((item) => item.relevance)
);

const rankedProducts = recommendationCandidates
  .map((item) => {
    const relevanceScore =
      (item.relevance / maxRelevance) * 100;

    const finalScore =
      relevanceScore * 0.30 +
      item.ratingScore * 0.20 +
      item.sellerTrustScore * 0.20 +
      item.budgetScore * 0.15 +
      item.fulfillmentScore * 0.10 +
      item.aiQualityScore * 0.05;

    return {
      ...item,
      relevanceScore,
      finalScore,
    };
  })
  .sort((a, b) => b.finalScore - a.finalScore)
  .slice(0, 15);

// Prepare products for Gemini and the frontend.
const formattedProducts = rankedProducts.map((item) => {
  const product = item.product;
  const matchingOffers = item.availableOffers.filter(({ price }) =>
  isWithinBudget(price, intent)
);

const offersToFormat =
  matchingOffers.length > 0
    ? matchingOffers
    : item.availableOffers;

  const variantOffers = offersToFormat.map(
  ({ variant, offer }) => {
    const trust = offer.seller.trustMetric;

    return {
      id: variant.id,
      variantId: variant.id,
      offerId: offer.id,
      sellerId: offer.seller.id,
      price: Number(offer.price),
      stockQuantity: offer.stockQuantity,
      sellerName:
        offer.seller.businessName || "Independent Seller",
      condition: offer.condition,
      attributes: variant.attributes,

      sellerTrustScore: trust
        ? Number(trust.overallTrustScore)
        : null,

      sellerRating: trust
        ? Number(trust.averageRating)
        : null,

      fulfillmentRate: trust
        ? Number(trust.fulfillmentRate)
        : null,

      returnRate: trust
        ? Number(trust.returnRate)
        : null,

      totalOrders: trust?.totalOrders ?? 0,
    };
  }
);

  const best = variantOffers[0];

  return {
    id: product.id,
    productId: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    categoryName: product.category.name,

    imageUrl:
      product.images.find((image) => image.isPrimary)?.url ??
      product.images[0]?.url ??
      null,

    variantId: best.variantId,
    offerId: best.offerId,
    sellerId: best.sellerId,
    price: best.price,
    stockQuantity: best.stockQuantity,
    sellerName: best.sellerName,

    variants: variantOffers,
    images: product.images,

    // Product intelligence and trust signals.
    averageRating: Number(item.averageRating.toFixed(2)),
    reviewCount: item.reviewCount,
    verifiedReviewCount: item.verifiedReviewCount,
    sellerTrustScore: item.sellerTrustScore,
    fulfillmentRate: item.fulfillmentScore,
    budgetFitScore: Number(item.budgetScore.toFixed(2)),
    aiQualityScore: item.aiQualityScore,

    recommendationScore: Number(item.finalScore.toFixed(2)),

    recommendationReason:
      item.relevance > 0
        ? "Matches your shopping requirements and recommendation criteria."
        : "Recommended based on product quality, customer feedback and seller reliability.",
  };
});
// Generate an intelligent conversational response using Gemini.
let reply: string;
let recommendedProducts = formattedProducts;
let engine = "iBUY_HYBRID_SEARCH";
let isFallback = false;

try {
  const aiResult = await generateConciergeResponse({
    message,
    history: conversationHistory,
    products: formattedProducts,
  });

  // Only allow Gemini to recommend products actually retrieved
  // from the iBUY catalogue.
  const validProductIds = new Set(
    formattedProducts.map((product) => product.id)
  );

 const selectedIds = [
  ...new Set(
    aiResult.productIds.filter(
      (id): id is string => typeof id === "string"
    )
  ),
].filter((id) => validProductIds.has(id));

 const aiSelectedProducts = selectedIds
  .map((id) =>
    formattedProducts.find((product) => product.id === id)
  )
  .filter(
    (product): product is (typeof formattedProducts)[number] =>
      product !== undefined
  );

// Gemini enhances recommendations but never controls availability.
recommendedProducts =
  aiSelectedProducts.length > 0
    ? aiSelectedProducts
    : formattedProducts.slice(0, 10);
    

  reply = aiResult.reply;
  engine = "GEMINI_HYBRID_SEARCH";
} catch (aiError) {
  // Keep the shopping concierge functional if Gemini is unavailable.
  console.error("Concierge AI error:", aiError);

  isFallback = true;

  if (formattedProducts.length > 0) {
    const budgetText =
      intent.maxPrice !== null
        ? ` within your GH₵${intent.maxPrice} budget`
        : "";

    reply =
      `I found ${formattedProducts.length} product options${budgetText}. ` +
      "I've ranked them by relevance, available offers and your shopping interests.";
  } else {
    reply =
      "I couldn't find matching products with available stock and offers. " +
      "Try adjusting your budget or describing what you need differently.";
  }
}

// Record verified Concierge interactions.
// Analytics failures must never interrupt shopping.
try {
  const interactionEvents: {
    eventType: string;
    userId: string;
    productId: string;
    sellerId: string;
    categoryId: string;
  }[] = [];

  const isComparison = detectComparisonIntent(message);
  const isPurchaseIntent = detectPurchaseIntent(message);

  for (const product of recommendedProducts) {
    const rankedProduct = rankedProducts.find(
      (item) => item.product.id === product.id
    );

    if (!rankedProduct) continue;

    const categoryId = rankedProduct.product.categoryId;

    for (const offer of product.variants) {
      const baseEvent = {
        userId: session.user.id,
        productId: product.id,
        sellerId: offer.sellerId,
        categoryId,
      };

      // The offer was actually presented to the customer.
      interactionEvents.push({
        ...baseEvent,
        eventType: "RECOMMENDATION",
      });

      // Only record comparisons when the customer explicitly
      // requested a comparison.
      if (isComparison && product.variants.length > 1) {
        interactionEvents.push({
          ...baseEvent,
          eventType: "PRODUCT_COMPARISON",
        });
      }

      // Record explicit buying signals, not ordinary browsing.
      if (isPurchaseIntent) {
        interactionEvents.push({
          ...baseEvent,
          eventType: "PURCHASE_INTENT",
        });
      }
    }
  }

  if (interactionEvents.length > 0) {
    await db.conciergeInteraction.createMany({
      data: interactionEvents,
    });
  }
} catch (analyticsError) {
  console.error(
    "Concierge analytics recording failed:",
    analyticsError
  );
}

return NextResponse.json({
  reply,
  products: recommendedProducts,
  intent,
  personalization: {
    enabled: true,
    preferredCategoryCount: preferredCategories.size,
  },
  engine,
  isFallback,
});
  } catch (error: unknown) {
    console.error("Concierge API error:", error);

    return NextResponse.json(
      {
        reply: "I'm having trouble searching the catalogue right now. Please try again.",
        products: [],
        isFallback: true,
      },
      { status: 500 }
    );
  }
}