// src/app/api/wishlist/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ wishlist: [] });
    }

    const wishlistItems = await db.wishlist.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          include: {
            variants: { take: 1 },
            images: { where: { isPrimary: true }, take: 1 },
            seller: { select: { businessName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const wishlist = wishlistItems.map((item) => {
      const variant = item.product.variants[0];
      return {
        id: item.id,
        productId: item.productId,
        title: item.product.title,
        slug: item.product.slug,
        price: variant?.price ? parseFloat(variant.price.toString()) : 0,
        compareAtPrice: variant?.compareAtPrice ? parseFloat(variant.compareAtPrice.toString()) : null,
        imageUrl: item.product.images[0]?.url || null,
        sellerName: item.product.seller?.businessName,
        stockQuantity: variant?.stockQuantity || 0,
      };
    });

    return NextResponse.json({ wishlist });
  } catch (error) {
    console.error("Wishlist fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // Check if already in wishlist
    const existing = await db.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ message: "Already in wishlist" });
    }

    const wishlistItem = await db.wishlist.create({
      data: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true, item: wishlistItem }, { status: 201 });
  } catch (error) {
    console.error("Wishlist add error:", error);
    return NextResponse.json({ error: "Failed to add to wishlist" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await req.json();

    await db.wishlist.deleteMany({
      where: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wishlist remove error:", error);
    return NextResponse.json({ error: "Failed to remove from wishlist" }, { status: 500 });
  }
}