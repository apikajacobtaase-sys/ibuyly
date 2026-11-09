import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ items: [] });
    }

    const wishlist = await db.wishlist.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
            variants: {
              orderBy: { createdAt: "asc" },
              where: {
                isActive: true,
                sellerOffers: {
                  some: {
                    status: "ACTIVE",
                    stockQuantity: { gt: 0 },
                  },
                },
              },
              take: 1,
              include: {
                sellerOffers: {
                  where: {
                    status: "ACTIVE",
                    stockQuantity: { gt: 0 },
                  },
                  orderBy: { price: "asc" },
                  take: 1,
                  include: {
                    seller: {
                      select: {
                        id: true,
                        businessName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedItems = wishlist.map(({ product }) => {
      const variant = product.variants[0];
      const offer = variant?.sellerOffers[0];

      return {
        id: product.id,
        productId: product.id,
        title: product.title,
        slug: product.slug,
        imageUrl: product.images[0]?.url ?? null,
        variantId: offer ? variant.id : null,
        offerId: offer?.id ?? null,
        sellerId: offer?.seller.id ?? null,
        sellerName: offer?.seller.businessName ?? "No seller available",
        price: offer ? Number(offer.price) : 0,
        stockQuantity: offer?.stockQuantity ?? 0,
        inStock: Boolean(offer && offer.stockQuantity > 0),
      };
    });

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error("GET Wishlist Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const productId = body?.productId;

    if (typeof productId !== "string" || !productId.trim()) {
      return NextResponse.json(
        { error: "A valid productId is required" },
        { status: 400 }
      );
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    await db.wishlist.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Wishlist Error:", error);

    return NextResponse.json(
      { error: "Failed to add to wishlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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
      await db.wishlist.deleteMany({
        where: { userId: session.user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Wishlist Error:", error);

    return NextResponse.json(
      { error: "Failed to remove from wishlist" },
      { status: 500 }
    );
  }
}
