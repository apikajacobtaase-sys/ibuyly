 // src/app/api/products/[slug]/reviews/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const product = await db.product.findUnique({
      where: { slug: params.slug },
      include: {
        reviews: {
          include: {
            user: { select: { firstName: true, lastName: true, image: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Calculate average rating
    const totalRating = product.reviews.reduce((acc, rev) => acc + rev.rating, 0);
    const avgRating = product.reviews.length > 0 ? totalRating / product.reviews.length : 0;

    return NextResponse.json({
      reviews: product.reviews,
      avgRating: Number(avgRating.toFixed(1)),
      totalReviews: product.reviews.length
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rating, title, comment, orderId } = await req.json();
    
    if (rating < 1 || rating > 5) return NextResponse.json({ error: "Invalid rating" }, { status: 400 });

    const product = await db.product.findUnique({ where: { slug: params.slug } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // ✅ Verification Logic: Check if user actually bought this product
    let isVerified = false;
    if (orderId) {
      const order = await db.order.findUnique({ 
        where: { id: orderId, userId: session.user.id },
        include: { items: { include: { variant: true } } }
      });
      
      // Check if any item in the order belongs to this product
      isVerified = order?.items.some(i => i.variant.productId === product.id) || false;
    }

    const review = await db.review.create({
      data: {
        userId: session.user.id,
        productId: product.id,
        rating,
        title: title || null,
        comment: comment || null,
        orderId: orderId || null,
        isVerified: isVerified // ✅ Set based on purchase history
      }
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Review submission error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}