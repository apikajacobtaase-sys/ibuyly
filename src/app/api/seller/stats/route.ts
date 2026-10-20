// src/app/api/seller/stats/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check if user is seller owner or has membership
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    let sellerId: string | null = null;

    if (sellerProfile) {
      sellerId = sellerProfile.id;
    } else {
      // Check if user has membership with any seller
      const membership = await db.sellerMembership.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (membership) {
        sellerId = membership.sellerId;
      }
    }

    if (!sellerId) {
      return NextResponse.json({ error: "No seller access" }, { status: 403 });
    }

    // 2. Run all queries in parallel using the SAFE `sellerId` variable
    const [
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts,
      recentOrders,
      allOrderItems,
    ] = await Promise.all([
      db.product.count({ where: { sellerId } }),
      db.product.count({ where: { sellerId, status: "ACTIVE" } }),
      db.product.count({ where: { sellerId, status: "DRAFT" } }),
      db.productVariant.findMany({
        where: {
          product: { sellerId },
          stockQuantity: { lte: db.productVariant.fields.lowStockThreshold },
        },
        include: { product: { select: { title: true, slug: true } } },
        take: 5,
      }),
      db.order.findMany({
        where: {
          items: { some: { sellerId } },
          status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
        include: {
          items: { where: { sellerId } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.orderItem.findMany({
        where: {
          sellerId,
          order: { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
        },
      }),
    ]);

    // 3. Calculate total sales (sum of price * quantity)
    const totalSales = allOrderItems.reduce((sum, item) => {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      return sum + price * item.quantity;
    }, 0);

    // 4. Count pending orders
    const pendingOrderCount = await db.order.count({
      where: {
        items: { some: { sellerId } },
        status: "PENDING",
      },
    });

    // 5. Calculate total orders
    const totalOrders = await db.order.count({
      where: { items: { some: { sellerId } } },
    });

    // 6. Best performing products (by quantity sold)
    const productSales = new Map<string, { title: string; slug: string; quantity: number; revenue: number }>();
    for (const item of allOrderItems) {
      const existing = productSales.get(item.variantId) || {
        title: item.title || "Unknown Product",
        slug: "",
        quantity: 0,
        revenue: 0,
      };
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      existing.quantity += item.quantity;
      existing.revenue += price * item.quantity;
      productSales.set(item.variantId, existing);
    }

    const bestProducts = Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return NextResponse.json({
      totalSales,
      totalOrders,
      pendingOrders: pendingOrderCount,
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts: lowStockProducts.map((v) => ({
        variantId: v.id,
        productTitle: v.product.title,
        productSlug: v.product.slug,
        stockQuantity: v.stockQuantity,
        threshold: v.lowStockThreshold,
      })),
      recentOrders: recentOrders.map((o) => {
        const sellerItems = o.items.filter((i) => i.sellerId === sellerId);
        const subtotal = sellerItems.reduce((sum, i) => {
          const p = typeof i.price === "string" ? parseFloat(i.price) : i.price;
          return sum + p * i.quantity;
        }, 0);
        return {
          id: o.id,
          status: o.status,
          createdAt: o.createdAt,
          itemCount: sellerItems.reduce((sum, i) => sum + i.quantity, 0),
          subtotal,
        };
      }),
      bestProducts,
    });
  } catch (error) {
    console.error("Seller stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}