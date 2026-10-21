// src/app/api/seller/products/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Find the seller profile
    const seller = await db.seller.findFirst({
      where: { userId: session.user.id },
    });

    if (!seller) return NextResponse.json({ products: [], pagination: { totalPages: 0 } });

    // 2. Parse Query Params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    
    const skip = (page - 1) * limit;

    // 3. Build Where Clause
    // We look for products where the seller has an OFFER. This ensures we only show products the seller is actually selling.
    const where: any = {
      variants: {
        some: {
          sellerOffers: {
            some: {
              sellerId: seller.id,
            }
          }
        }
      },
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
      // Note: Status filtering might need to be on the Offer or Product depending on your schema
    };

    // 4. Fetch Products
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
          variants: {
            include: {
              sellerOffers: {
                where: { sellerId: seller.id },
                take: 1,
              }
            }
          }
        },
      }),
      db.product.count({ where })
    ]);

    // 5. Format Data for Frontend
    const formattedProducts = products.map(p => {
      const variant = p.variants[0];
      const offer = variant?.sellerOffers[0];
      
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status, // Or offer.status if you track status per offer
        imageUrl: p.images[0]?.url || null,
        categoryName: p.category?.name || "Uncategorized",
        reviewCount: 0,
        createdAt: p.createdAt.toISOString(),
        price: offer ? parseFloat(offer.price.toString()) : 0,
        stock: offer?.stockQuantity || 0,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        totalPages: Math.ceil(total / limit),
        total,
      }
    });

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