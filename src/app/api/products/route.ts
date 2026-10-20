  // src/app/api/products/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    const products = await db.product.findMany({
      include: {
        variants: {
          include: {
            sellerOffers: {
              include: {
                seller: { select: { id: true, businessName: true } }
              }
            }, 
          },
        },
        images: { 
          take: 1,
          select: { url: true } 
        }, 
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const formattedProducts = products.map((p) => {
      let lowestPrice: number | null = null;
      let isAnyInStock = false;
      
      let bestOfferId: string | null = null;
      let bestVariantId: string | null = null;
      let bestSellerId: string | null = null;
      let bestSellerName: string | null = null;
      let bestStockQuantity: number = 0;

      for (const v of p.variants) {
        const offers = v.sellerOffers || [];
        const inStockOffers = offers.filter((o: any) => o.stockQuantity > 0);
        
        if (inStockOffers.length > 0) {
          isAnyInStock = true;
          // Find the cheapest IN-STOCK offer
          const cheapestOffer = inStockOffers.reduce((min: any, o: any) => 
            parseFloat(o.price.toString()) < parseFloat(min.price.toString()) ? o : min
          );
          
          const offerPrice = parseFloat(cheapestOffer.price.toString());
          if (lowestPrice === null || offerPrice < lowestPrice) {
            lowestPrice = offerPrice;
            bestOfferId = cheapestOffer.id;
            bestVariantId = v.id;
            bestSellerId = cheapestOffer.seller.id;
            bestSellerName = cheapestOffer.seller.businessName;
            bestStockQuantity = cheapestOffer.stockQuantity;
          }
        } else if (v.stockQuantity > 0) {
          // Fallback to global variant if no seller offers are in stock
          isAnyInStock = true;
          const vPrice = parseFloat(v.price.toString());
          if (lowestPrice === null || vPrice < lowestPrice) {
            lowestPrice = vPrice;
            bestVariantId = v.id;
            bestStockQuantity = v.stockQuantity;
            bestSellerId = p.sellerId || "global";
            bestSellerName = "iBUY Marketplace";
          }
        }
      }

      const firstImage = p.images?.[0];
      const imageUrl = firstImage?.url || null;

      return {
        id: p.id,
        title: p.title || "Untitled Product",
        slug: p.slug || "",
        price: lowestPrice ?? 0,
        imageUrl: imageUrl,
        stockQuantity: bestStockQuantity, // 👈 The accurate "Buy Box" stock
        inStock: isAnyInStock,
        categoryName: p.category?.name || "General",
        sellerId: bestSellerId,
        sellerName: bestSellerName,
        bestOfferId: bestOfferId,   // 👈 CRITICAL for Add to Cart
        bestVariantId: bestVariantId, // 👈 CRITICAL for Add to Cart
      };
    });

    const total = await db.product.count();

    return NextResponse.json({
      products: formattedProducts,
      hasMore: skip + formattedProducts.length < total,
      total,
    });
  } catch (error: any) {
    console.error("🚨 PRODUCTS API CRASHED:", error.message);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}