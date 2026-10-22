 // src/app/api/products/[slug]/reviews/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.slug;

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { slug: slug },
      include: {
        reviews: {
          include: {
            user: { 
              // ✅ FIX: Use avatarUrl instead of image
              select: { firstName: true, lastName: true, avatarUrl: true } 
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const reviewList = product.reviews || [];
    const totalRating = reviewList.reduce((acc, rev) => acc + rev.rating, 0);
    const avgRating = reviewList.length > 0 ? totalRating / reviewList.length : 0;

    return NextResponse.json({
      reviews: reviewList,
      avgRating: Number(avgRating.toFixed(1)),
      totalReviews: reviewList.length
    });

  } catch (error) {
    console.error("GET Reviews Error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch reviews", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
// ✅ FIX: Await params in POST
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params; // ✅ Unwrap promise
    const slug = resolvedParams.slug;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rating, title, comment, orderId } = await req.json();
    
    if (rating < 1 || rating > 5) return NextResponse.json({ error: "Invalid rating" }, { status: 400 });

    const product = await db.product.findUnique({ where: { slug: slug } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // ... Rest of your POST logic (Verification, Creation, etc.) ...
    let isVerified = false;
    if (orderId) {
      const order = await db.order.findUnique({ 
        where: { id: orderId, userId: session.user.id },
        include: { items: { include: { variant: true } } }
      });
      isVerified = order?.items.some(i => i.variant.productId === product.id) || false;
    }

   const review = await db.review.upsert({
      where: {
        // This matches the @@unique constraint in your schema
        userId_productId: {
          userId: session.user.id,
          productId: product.id,
        }
      },
      update: {
        rating,
        title: title || null,
        comment: comment || null,
        orderId: orderId || null,
        isVerified: isVerified,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        productId: product.id,
        rating,
        title: title || null,
        comment: comment || null,
        orderId: orderId || null,
        isVerified: isVerified,
      },
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Review submission error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
