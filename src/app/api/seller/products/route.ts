// src/app/api/seller/products/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensions, cheap and fast
    input: text.replace(/\n/g, " ").substring(0, 8000), // Max 8k tokens
    encoding_format: "float",
  });
  return response.data[0].embedding;
}
const CreateProductSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  price: z.union([z.string(), z.number()]).transform(Number),
  compareAtPrice: z.union([z.string(), z.number()]).optional().nullable().transform((val) => val ? Number(val) : null),
  costPrice: z.union([z.string(), z.number()]).optional().nullable().transform((val) => val ? Number(val) : null),
  sku: z.string().min(1, "SKU is required"),
  stock: z.union([z.string(), z.number()]).transform(Number),
  status: z.enum(["DRAFT", "ACTIVE"]),
  imageUrls: z.array(z.string()).min(1, "At least one image is required"),
  attributes: z.record(z.string(), z.string()).optional(),
});

 
// Replace the POST function in src/app/api/seller/products/route.ts

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });
    }

    const body = await req.json();
    const validation = CreateProductSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, categoryId, price, compareAtPrice, costPrice, sku, stock, status, imageUrls, attributes } = validation.data;

    // 1. Check if this exact variant (by SKU) already exists globally
    const existingVariant = await db.productVariant.findUnique({
      where: { sku },
      include: { product: true },
    });

    let variantId: string;
    let productId: string;

    if (existingVariant) {
      // ✅ GLOBAL PRODUCT EXISTS: Just link to it
      variantId = existingVariant.id;
      productId = existingVariant.productId;
    } else {
      // ✅ NEW GLOBAL PRODUCT: Create it without a sellerId (true global catalogue)
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);
      
      const newProduct = await db.product.create({
        data: {
          title,
          slug,
          description,
          categoryId,
          // sellerId is now optional, leave it null for global catalogue items
          status,
          attributes: (attributes as any) || {},
          images: { create: imageUrls.map((url) => ({ url })) },
          variants: {
            create: {
              price,
              compareAtPrice,
              costPrice,
              sku,
              stockQuantity: 0, // Global variant stock is 0; seller stock is in SellerOffer
            },
          },
        },
        include: { variants: true },
      });
      
      variantId = newProduct.variants[0].id;
      productId = newProduct.id;

      // Generate embedding for new global products
      if (status === "ACTIVE") {
        try {
          const embedding = await generateEmbedding(`${title}. ${description}`);
          await db.product.update({ where: { id: productId }, data: { embedding } });
        } catch (embedError) {
          console.error("Embedding failed:", embedError);
        }
      }
    }

    // 2. THE MAGIC: Create or Update the Seller's specific offer for this variant
    const sellerOffer = await db.sellerOffer.upsert({
      where: {
        // This unique constraint ensures a seller can only have ONE offer per variant
        sellerId_variantId: {
          sellerId: sellerProfile.id,
          variantId: variantId,
        },
      },
      update: {
        // If restocking, ADD to existing stock. If you want to SET exact stock, change to: stockQuantity: stock
        stockQuantity: { increment: stock }, 
        price: price, // Update to the seller's latest price
        status: status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      },
      create: {
        sellerId: sellerProfile.id,
        variantId: variantId,
        price: price,
        stockQuantity: stock, // Initial stock
        sellerSku: `${sku}-${sellerProfile.id.slice(-4)}`, // Unique seller SKU
        condition: "NEW",
        status: status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: existingVariant ? "Product restocked successfully!" : "New product added to catalogue!",
      offerId: sellerOffer.id 
    }, { status: 201 });

  } catch (error: any) {
    console.error("🚨 Create/Restock product error:", error);
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 });
  }
}


export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });
    }

    // Parse query parameters for pagination and filtering
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status"); // e.g., "ACTIVE", "PAUSED", or null for all
    const query = searchParams.get("query");

    const skip = (page - 1) * limit;

    // Build the where clause for SellerOffer
    const whereClause: any = {
      sellerId: sellerProfile.id,
    };

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // Allow searching by the global product's title
    if (query) {
      whereClause.variant = {
        product: {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
      };
    }

    // Fetch offers and total count in parallel for performance
    const [offers, total] = await Promise.all([
      db.sellerOffer.findMany({
        where: whereClause,
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  description: true,
                  status: true, // Global product status
                  category: { select: { name: true } },
                  images: { take: 1, select: { url: true } },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      db.sellerOffer.count({
        where: whereClause,
      }),
    ]);

    // Format the data to match what the frontend UI expects
    const formattedProducts = offers.map((offer) => {
      const product = offer.variant.product;
      const image = product.images[0];

      return {
        id: product.id, // Keep product ID for routing to /products/[slug]
        offerId: offer.id, // Pass offerId in case frontend needs it for edits
        title: product.title,
        slug: product.slug,
        description: product.description,
        status: offer.status, // 👈 CRITICAL: Use the SELLER OFFER status (ACTIVE/PAUSED)
        price: Number(offer.price), // 👈 CRITICAL: Use the SELLER OFFER price
        stock: Number(offer.stockQuantity), // 👈 CRITICAL: Use the SELLER OFFER stock!
        sku: offer.sellerSku || offer.variant.sku || "N/A",
        imageUrl: image?.url || null,
        categoryName: product.category?.name || "Uncategorized",
        createdAt: offer.createdAt,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("🚨 Fetch seller products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}