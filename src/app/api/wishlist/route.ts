 // src/app/api/wishlist/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ items: [] });

    const wishlist = await db.wishlist.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
            variants: { 
              take: 1, 
              include: { 
                sellerOffers: { 
                  where: { status: "ACTIVE" }, 
                  orderBy: { price: 'asc' }, 
                  take: 1,
                  include: { seller: { select: { businessName: true } } }
                } 
              } 
            },
          },
        },
      },
    });

    const formattedItems = wishlist.map((w) => ({
      id: w.productId,
      title: w.product.title,
      slug: w.product.slug,
      imageUrl: w.product.images[0]?.url || null,
      price: w.product.variants[0]?.sellerOffers[0]?.price 
        ? parseFloat(w.product.variants[0].sellerOffers[0].price.toString()) 
        : 0,
      sellerName: w.product.variants[0]?.sellerOffers[0]?.seller?.businessName || "Unknown",
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { productId } = await req.json();

    await db.wishlist.upsert({
      where: {
        userId_productId: { userId: session.user.id, productId },
      },
      update: {},
      create: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add to wishlist" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (productId) {
  await db.wishlist.deleteMany({
    where: {
      userId: session.user.id,
      productId,
    },
  });
} else {
  // Clear the authenticated user's entire wishlist.
  await db.wishlist.deleteMany({
    where: {
      userId: session.user.id,
    },
  });
}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to remove from wishlist" }, { status: 500 });
  }
}