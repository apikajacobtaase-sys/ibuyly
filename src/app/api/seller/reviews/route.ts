// src/app/api/seller/reviews/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get seller profile
    let sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      sellerProfile = await db.sellerProfile.create({
        data: {
          userId: session.user.id,
          businessName: session.user.name || "My Store",
          isActive: true,
        },
      });
    }

    // Fetch reviews
    const reviews = await db.sellerReview.findMany({
      where: { sellerId: sellerProfile.id },
      include: {
        buyer: {
          select: { firstName: true, lastName: true, email: true }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate average rating
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    // Rating distribution
    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        isVerified: r.isVerified,
        sellerResponse: r.sellerResponse,
        respondedAt: r.respondedAt,
        createdAt: r.createdAt,
        buyerName: r.buyer.name || "Anonymous",
      })),
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
    });
  } catch (error) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

const RespondSchema = z.object({
  reviewId: z.string().cuid(),
  response: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = RespondSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { reviewId, response } = validation.data;

    // Verify the review belongs to this seller
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    const review = await db.sellerReview.findUnique({
      where: { id: reviewId, sellerId: sellerProfile.id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Update review with seller response
    await db.sellerReview.update({
      where: { id: reviewId },
      data: {
        sellerResponse: response,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Respond to review error:", error);
    return NextResponse.json({ error: "Failed to respond to review" }, { status: 500 });
  }
}