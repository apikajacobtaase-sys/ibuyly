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

    // Fetch the user's saved wishlist products and delivered orders.
    // Recently viewed products remain in the existing client-side store.
    const [wishlistItems, orders] = await Promise.all([
      db.wishlist.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              id: true,
              categoryId: true,
            },
          },
        },
      }),

      db.order.findMany({
        where: {
          userId,
          status: "DELIVERED",
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      categoryId: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const categoryScores: Record<string, number> = {};

    // Wishlist products contribute 3 points to their categories.
    wishlistItems.forEach((item) => {
      const categoryId = item.product.categoryId;

      if (categoryId) {
        categoryScores[categoryId] =
          (categoryScores[categoryId] || 0) + 3;
      }
    });

    // Purchased products contribute 5 points to their categories.
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const categoryId = item.variant.product.categoryId;

        if (categoryId) {
          categoryScores[categoryId] =
            (categoryScores[categoryId] || 0) + 5;
        }
      });
    });

    const interests = {
      categories: categoryScores,
      searchTerms: [] as string[],
      viewedProducts: [] as string[],
      wishlistProducts: wishlistItems.map((item) => item.product.id),
    };

    return NextResponse.json({ interests });
  } catch (error: unknown) {
    console.error("User interests error:", error);

    return NextResponse.json(
      { error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}