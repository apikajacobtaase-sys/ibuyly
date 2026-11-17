  import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateConciergeResponse } from "@/lib/concierge-ai";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const getIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0
      )
    ),
  ].slice(0, 8);
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message || message.length > 1000) {
      return NextResponse.json(
        { error: "Enter a valid message." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const sessionId =
      typeof body.sessionId === "string" &&
      body.sessionId.length <= 100
        ? body.sessionId
        : randomUUID();

    // Explicitly selected products always receive highest priority.
    const selectedProductIds = getIds(body.selectedProductIds);
    const productIds = getIds(body.productIds);
    const discoveredProductIds = getIds(
      body.discoveredProductIds
    );

    const contextProductIds = [
      ...new Set([
        ...selectedProductIds,
        ...productIds,
        ...discoveredProductIds,
      ]),
    ].slice(0, 8);

    // Load the actual product information from the database.
    const databaseProducts = contextProductIds.length
      ? await db.product.findMany({
          where: {
            id: { in: contextProductIds },
            status: "ACTIVE",
          },
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
              where: {
                isActive: true,
              },
              select: {
                id: true,
                sku: true,
                sellerOffers: {
                  where: {
                    status: "ACTIVE",
                    stockQuantity: { gt: 0 },
                    seller: {
                      isActive: true,
                    },
                  },
                  select: {
                    id: true,
                    price: true,
                    stockQuantity: true,
                    seller: {
                      select: {
                        businessName: true,
                        verifiedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];

    // Preserve the customer's requested product order.
    const productMap = new Map(
      databaseProducts.map((product) => [
        product.id,
        product,
      ])
    );

    const products = contextProductIds
      .map((id) => productMap.get(id))
      .filter(
        (product): product is NonNullable<typeof product> =>
          Boolean(product)
      )
      .map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        attributes: product.attributes,
        semanticTags: product.semanticTags,
        category: product.category,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          offers: variant.sellerOffers.map((offer) => ({
            id: offer.id,
            price: Number(offer.price),
            stockQuantity: offer.stockQuantity,
            seller: offer.seller
              ? {
                  businessName: offer.seller.businessName,
                  verified: Boolean(offer.seller.verifiedAt),
                }
              : null,
          })),
        })),
      }));

    // Retrieve previous conversation messages.
    let history: Message[] = [];

    if (userId) {
      const previous = await db.aIConversation.findMany({
        where: {
          userId,
          sessionId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
        select: {
          role: true,
          content: true,
        },
      });

      history = previous
        .reverse()
        .filter(
          (item): item is Message =>
            (item.role === "user" ||
              item.role === "assistant") &&
            typeof item.content === "string"
        );
    } else if (Array.isArray(body.conversationHistory)) {
      history = body.conversationHistory
        .filter(
          (item: unknown): item is Message =>
            typeof item === "object" &&
            item !== null &&
            "role" in item &&
            "content" in item &&
            ((item as Message).role === "user" ||
              (item as Message).role === "assistant") &&
            typeof (item as Message).content === "string"
        )
        .slice(-12);
    }

    // Generate a response using the actual selected products.
    const result = await generateConciergeResponse({
      message,
      history,
      products: products as unknown as Record<
        string,
        unknown
      >[],
    });

    // Recommendations must always reference supplied products.
    const validIds = new Set(
      products.map((product) => product.id)
    );

    const validProductIds = [
      ...new Set(
        result.productIds.filter((id) =>
          validIds.has(id)
        )
      ),
    ];

    // Save authenticated conversations.
    if (userId) {
      await db.aIConversation.createMany({
        data: [
          {
            userId,
            sessionId,
            role: "user",
            content: message,
            metadata: {
              productIds: contextProductIds,
              discoveredProductIds,
              selectedProductIds,
            },
          },
          {
            userId,
            sessionId,
            role: "assistant",
            content: result.reply,
            metadata: {
              productIds: validProductIds,
              discoveredProductIds,
              selectedProductIds,
            },
          },
        ],
      });
    }

    return NextResponse.json({
      reply: result.reply,
      sessionId,
      productIds: validProductIds,
      context: {
        productCount: products.length,
        selectedProductCount: selectedProductIds.length,
      },
    });
  } catch (error) {
    console.error("Comparison chat error:", error);

    return NextResponse.json(
      {
        error:
          "I'm having trouble responding right now. Please try again.",
      },
      { status: 500 }
    );
  }
}