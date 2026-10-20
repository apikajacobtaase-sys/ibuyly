 // src/app/api/seller/offers/route.ts
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

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    // Fetch seller offers
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

    // Filter and format
    const formattedOffers = offers.map((offer) => {
      // 👇 CRITICAL: Use the SELLER OFFER stock, NOT the global variant stock
      const offerStock = offer.stockQuantity; 
      
      let show = true;
      if (filter === "low_stock") show = offerStock > 0 && offerStock <= 10;
      if (filter === "out_of_stock") show = offerStock === 0;

      return {
        ...offer,
        stockQuantity: offerStock, // 👈 Strictly the seller's own stock
        show,
      };
    }).filter((offer) => offer.show);

    return NextResponse.json({ offers: formattedOffers });
  } catch (error) {
    console.error("Fetch offers error:", error);
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!sellerProfile) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const body = await req.json();
    const { variantId, price, stockQuantity, condition, sellerSku } = body;

    // 👇 ATOMIC UPDATE: ONLY update the Seller's specific offer pool
    await db.sellerOffer.upsert({
      where: {
        sellerId_variantId: {
          sellerId: sellerProfile.id,
          variantId: variantId,
        },
      },
      update: {
        price: parseFloat(price),
        stockQuantity: parseInt(stockQuantity, 10),
        condition: condition,
        sellerSku: sellerSku || null,
        status: "ACTIVE",
      },
      create: {
        sellerId: sellerProfile.id,
        variantId: variantId,
        price: parseFloat(price),
        stockQuantity: parseInt(stockQuantity, 10),
        condition: condition,
        sellerSku: sellerSku || null,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, message: "Stock added successfully" });
  } catch (error) {
    console.error("Create offer error:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}