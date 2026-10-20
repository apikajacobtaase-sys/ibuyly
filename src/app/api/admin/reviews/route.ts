// src/app/api/admin/reviews/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rating = searchParams.get("rating");
    const verified = searchParams.get("verified");

    const where: any = {};
    if (rating) where.rating = parseInt(rating);
    if (verified === "true") where.isVerified = true;
    if (verified === "false") where.isVerified = false;

    const reviews = await db.review.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        product: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        userName: r.user.firstName || r.user.email.split("@")[0],
        userEmail: r.user.email,
        productTitle: r.product.title,
        productSlug: r.product.slug,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { reviewId } = await req.json();

    const review = await db.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await db.review.delete({ where: { id: reviewId } });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REVIEW_DELETED",
        resourceType: "Review",
        resourceId: reviewId,
        metadata: { productId: review.productId, userId: review.userId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}