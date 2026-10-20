 // src/app/api/search/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // 1. Fetch Products with Variants and their Seller Offers
    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          seller: { select: { businessName: true, id: true } },
          variants: {
            where: { isActive: true },
            include: {
              sellerOffers: {
                where: { 
                  status: "ACTIVE", 
                  stockQuantity: { gt: 0 } 
                },
                include: { 
                  seller: { select: { businessName: true, id: true } } 
                },
                orderBy: { price: 'asc' },
                take: 1
              },
            },
          },
        },
      }),
      db.product.count({
        where: {
          status: "ACTIVE",
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    // DEBUG: Inspect the actual product → variant → seller offer relationship.
if (products.length > 0) {
  for (const product of products.slice(0, 3)) {
    console.log("🔍 PRODUCT OFFER DEBUG:", {
      productId: product.id,
      title: product.title,
      variants: product.variants.map((variant) => ({
        variantId: variant.id,
        offers: variant.sellerOffers.map((offer) => ({
          offerId: offer.id,
          price: offer.price.toString(),
          stockQuantity: offer.stockQuantity,
          status: offer.status,
          sellerId: offer.seller?.id,
        })),
      })),
    });
  }
}

    const formattedProducts = products.map((product) => {
      let bestOffer: any = null;
      let bestVariantId: string | null = null;

      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.sellerOffers && variant.sellerOffers.length > 0) {
            const offer = variant.sellerOffers[0];
            if (!bestOffer || parseFloat(offer.price.toString()) < parseFloat(bestOffer.price.toString())) {
              bestOffer = offer;
              bestVariantId = variant.id;
            }
          }
        }
      }

      return {
        id: product.id,
        title: product.title || "Untitled Product",
        slug: product.slug || "",
        
        price: bestOffer ? parseFloat(bestOffer.price.toString()) : 0,
        stockQuantity: bestOffer ? bestOffer.stockQuantity : 0,
        
        // ✅ CRITICAL: Ensure these are mapped correctly
        bestOfferId: bestOffer?.id || null,
        bestVariantId: bestVariantId,
        
        imageUrl: (product.images && product.images.length > 0) ? product.images[0].url : null,
        
        sellerName: bestOffer?.seller?.businessName || product.seller?.businessName || "iBUY Marketplace",
        sellerId: bestOffer?.seller?.id || product.sellerId || "unknown",
        inStock: !!bestOffer,
      };
    });
     console.log(
  "📦 FORMATTED SEARCH PRODUCTS:",
  formattedProducts.slice(0, 5).map((product) => ({
    id: product.id,
    title: product.title,
    bestOfferId: product.bestOfferId,
    bestVariantId: product.bestVariantId,
    price: product.price,
    stockQuantity: product.stockQuantity,
    inStock: product.inStock,
  }))
);
    return NextResponse.json({ 
      products: formattedProducts, 
      total,
      page,
      hasMore: total > skip + limit
    });

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: String(error) },
      { status: 500 }
    );
  }
}