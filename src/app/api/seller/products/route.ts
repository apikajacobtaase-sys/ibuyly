 // src/app/api/seller/products/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Find the seller profile associated with the user
    const seller = await db.seller.findFirst({
      where: { userId: session.user.id },
    });

    if (!seller) return NextResponse.json({ products: [] });

    // 2. Fetch Products with necessary relations
    const products = await db.product.findMany({
      where: { sellerId: seller.id },
      include: {
        category: { select: { name: true } }, // ✅ Added Category
        images: { where: { isPrimary: true }, take: 1 },
        variants: {
          include: {
            sellerOffers: {
              where: { sellerId: seller.id }, // ✅ Only get offers from THIS seller
              take: 1,
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Format Data to Match Frontend Interface
    const formattedProducts = products.map((p) => {
      // Get the first variant and its offer
      const variant = p.variants[0];
      const offer = variant?.sellerOffers[0];

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        imageUrl: p.images[0]?.url || null,
        categoryName: p.category?.name || "Uncategorized",
        reviewCount: 0, // Default if not calculated
        createdAt: p.createdAt.toISOString(),
        
        // ✅ Extract Price and Stock from the Offer
        price: offer ? parseFloat(offer.price.toString()) : 0,
        stock: offer?.stockQuantity || 0,
      };
    });

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error("GET Seller Products Error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("id");

    if (!productId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // Verify ownership before deleting
    const product = await db.product.findUnique({
      where: { id: productId },
      include: { seller: true }
    });

    if (product?.seller.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.product.delete({ where: { id: productId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { productId, price, stockQuantity } = body;

    // Update the offer price and stock
    await db.sellerOffer.updateMany({
      where: {
        variant: {
          productId: productId,
          seller: { userId: session.user.id }
        }
      },
      data: {
        price: price ? String(price) : undefined,
        stockQuantity: stockQuantity !== undefined ? stockQuantity : undefined,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}