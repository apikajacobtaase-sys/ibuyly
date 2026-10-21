 // src/app/api/seller/products/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Find the seller profile associated with the user
    const seller = await db.seller.findFirst({
      where: { userId: session.user.id },
    });

    if (!seller) return NextResponse.json({ products: [] });

    const products = await db.product.findMany({
      where: { sellerId: seller.id },
      include: {
        variants: {
          include: {
            sellerOffers: {
              include: { seller: { select: { businessName: true } } }
            }
          }
        },
        images: { where: { isPrimary: true }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ products });
  } catch (error) {
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
    // Note: This assumes one primary offer per variant for simplicity
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