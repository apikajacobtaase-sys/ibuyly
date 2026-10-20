// src/app/api/user/interests/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ interests: null });
    }

    const userId = session.user.id;

    // Fetch user's browsing history, wishlist, and category interests
    const [viewedProducts, wishlistItems, orders] = await Promise.all([
      db.viewedProduct.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        take: 20,
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      }),
      db.wishlist.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      }),
      db.order.findMany({
        where: { 
          userId,
          status: "DELIVERED"
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate category interests
    const categoryScores: Record<string, number> = {};

    // From viewed products (weight: 1)
    viewedProducts.forEach((view) => {
      if (view.product.categoryId) {
        categoryScores[view.product.categoryId] = (categoryScores[view.product.categoryId] || 0) + 1;
      }
    });

    // From wishlist (weight: 3)
    wishlistItems.forEach((item) => {
      if (item.product.categoryId) {
        categoryScores[item.product.categoryId] = (categoryScores[item.product.categoryId] || 0) + 3;
      }
    });

    // From purchases (weight: 5)
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.variant.product.categoryId) {
          categoryScores[item.variant.product.categoryId] = 
            (categoryScores[item.variant.product.categoryId] || 0) + 5;
        }
      });
    });

    // Apply time decay (recent activity matters more)
    const now = new Date();
    Object.keys(categoryScores).forEach((catId) => {
      const recentViews = viewedProducts.filter(
        (v) => v.product.categoryId === catId && 
        (now.getTime() - v.viewedAt.getTime()) < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      ).length;
      
      categoryScores[catId] += recentViews * 2; // Bonus for recent activity
    });

    const interests = {
      categories: categoryScores,
      searchTerms: [], // Could be fetched from search history
      viewedProducts: viewedProducts.map((v) => v.productId),
      wishlistProducts: wishlistItems.map((w) => w.productId),
    };

    return NextResponse.json({ interests });
  } catch (error: any) {
    console.error("🚨 User interests error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch interests" }, { status: 500 });
  }
}