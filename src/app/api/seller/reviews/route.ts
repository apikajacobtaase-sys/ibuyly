// src/app/api/seller/reviews/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

export async function GET() {
  try {
    const access = await authorizeSeller("manage_reviews");

    if (!access.authorized) {
      return access.response;
    }

    const reviews = await db.sellerReview.findMany({
      where: { sellerId: access.sellerId },
      include: {
        buyer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalReviews = reviews.length;

    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          totalReviews
        : 0;

    const ratingDistribution = {
      5: reviews.filter((review) => review.rating === 5).length,
      4: reviews.filter((review) => review.rating === 4).length,
      3: reviews.filter((review) => review.rating === 3).length,
      2: reviews.filter((review) => review.rating === 2).length,
      1: reviews.filter((review) => review.rating === 1).length,
    };

    return NextResponse.json({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isVerified: review.isVerified,
        sellerResponse: review.sellerResponse,
        respondedAt: review.respondedAt,
        createdAt: review.createdAt,
        buyerName:
          [review.buyer.firstName, review.buyer.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "Anonymous",
      })),
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
    });
  } catch (error) {
    console.error("Fetch seller reviews error:", error);

    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

const RespondSchema = z.object({
  reviewId: z.string().cuid(),
  response: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const access = await authorizeSeller("manage_reviews");

    if (!access.authorized) {
      return access.response;
    }

    const body = await req.json();
    const validation = RespondSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { reviewId, response } = validation.data;

    const review = await db.sellerReview.findFirst({
      where: {
        id: reviewId,
        sellerId: access.sellerId,
      },
      select: { id: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    await db.sellerReview.update({
      where: { id: review.id },
      data: {
        sellerResponse: response,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Respond to seller review error:", error);

    return NextResponse.json(
      { error: "Failed to respond to review" },
      { status: 500 }
    );
  }
}