// src/app/api/user/reviews/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const CreateReviewSchema = z.object({
  orderId: z.string().cuid("Invalid order ID"),
  sellerId: z.string().cuid("Invalid seller ID"),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, "Review must be at least 10 characters").max(1000),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = CreateReviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { orderId, sellerId, rating, comment } = validation.data;

    // 🔒 SECURITY: Verify this order belongs to this customer
    const order = await db.order.findUnique({
      where: { id: orderId, userId: session.user.id },
      include: {
        items: {
          where: { sellerId },
          select: { id: true, status: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.items.length === 0) {
      return NextResponse.json(
        { error: "This order does not contain items from this seller" },
        { status: 400 }
      );
    }

    // Check all items from this seller are delivered
    const allDelivered = order.items.every((item) => item.status === "DELIVERED");
    if (!allDelivered) {
      return NextResponse.json(
        { error: "Can only review orders after all items are delivered" },
        { status: 400 }
      );
    }

    // 🔒 Prevent duplicate reviews
    const existingReview = await db.sellerReview.findFirst({
      where: {
        orderId,
        buyerId: session.user.id,
        sellerId,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this order from this seller" },
        { status: 400 }
      );
    }

    // Create the review
    const review = await db.sellerReview.create({
      data: {
        orderId,
        buyerId: session.user.id,
        sellerId,
        rating,
        comment,
        isVerified: true, // Auto-verify since we confirmed the purchase
      },
    });

    return NextResponse.json(
      { success: true, reviewId: review.id, message: "Review submitted successfully!" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("🚨 Submit review error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}