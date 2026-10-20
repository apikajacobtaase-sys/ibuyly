// src/app/api/seller/inventory/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

 export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!sellerProfile) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    // Fetch seller offers, joined with global variant data
    const offers = await db.sellerOffer.findMany({
      where: { sellerId: sellerProfile.id },
      include: {
        variant: {
          include: {
            product: { select: { title: true, slug: true, images: { take: 1, select: { url: true } } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

     // Inside src/app/api/seller/inventory/route.ts (GET function)

    const inventory = offers.map((offer) => {
      // 👇 CRITICAL: Use the SELLER OFFER stock, NOT the global variant stock
      const displayStock = offer.stockQuantity; 

      const threshold = offer.lowStockThreshold || 5;
      const stockStatus = displayStock === 0 ? "OUT_OF_STOCK" : displayStock <= threshold ? "LOW_STOCK" : "IN_STOCK";

      return {
        offerId: offer.id,
        variantId: offer.variantId,
        productTitle: offer.variant.product.title,
        productSlug: offer.variant.product.slug,
        imageUrl: offer.variant.product.images[0]?.url || null,
        sku: offer.variant.sku,
        sellerSku: offer.sellerSku,
        price: parseFloat(offer.price.toString()),
        
        // 👇 Strictly the seller's own stock
        stockQuantity: displayStock,       
        
        lowStockThreshold: threshold,
        stockStatus,
        status: offer.status,
      };
    });
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Fetch inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!sellerProfile) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const body = await req.json();
    const { offerId, stockQuantity, price, status, lowStockThreshold } = body;

    // 1. VERIFY OWNERSHIP: Ensure this offer belongs to the logged-in seller
    const offer = await db.sellerOffer.findUnique({
      where: { id: offerId },
      include: { variant: { select: { id: true } } }, // 👈 Include variant to update it too
    });

    if (!offer || offer.sellerId !== sellerProfile.id) {
      return NextResponse.json({ error: "Unauthorized to update this item" }, { status: 403 });
    }

    // 2. UPDATE BOTH TABLES IN A TRANSACTION TO KEEP THEM IN SYNC
    await db.$transaction(async (tx) => {
      // A. Update the Seller's specific offer
      await tx.sellerOffer.update({
        where: { id: offerId },
        data: {
          ...(stockQuantity !== undefined && { stockQuantity: parseInt(stockQuantity) }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(status !== undefined && { status }),
        },
      });

      // B. 👇 CRITICAL: Also update the global ProductVariant stock to match
      // This prevents the "0 vs 7" drift from ever happening again
      if (stockQuantity !== undefined && offer.variant) {
        await tx.productVariant.update({
          where: { id: offer.variant.id },
          data: { 
            stockQuantity: parseInt(stockQuantity),
            ...(lowStockThreshold !== undefined && { lowStockThreshold: parseInt(lowStockThreshold) })
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Inventory updated successfully" });
  } catch (error) {
    console.error("Update inventory error:", error);
    return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 });
  }
}