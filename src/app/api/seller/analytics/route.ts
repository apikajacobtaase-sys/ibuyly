// src/app/api/seller/analytics/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    // Get all seller's order items from completed orders
    const orderItems = await db.orderItem.findMany({
      where: {
        sellerId: sellerProfile.id,
        order: { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
      },
      include: {
        order: { select: { createdAt: true } },
      },
    });

    // Calculate daily sales for last 30 days
    const last30Days: { date: string; sales: number; orders: Set<string> }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last30Days.push({ date: dateStr, sales: 0, orders: new Set() });
    }

    for (const item of orderItems) {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      const itemTotal = price * item.quantity;
      const orderDate = item.order.createdAt.toISOString().split("T")[0];
      
      const dayEntry = last30Days.find((d) => d.date === orderDate);
      if (dayEntry) {
        dayEntry.sales += itemTotal;
        dayEntry.orders.add(item.order.createdAt.toISOString());
      }
    }

    // Calculate order status breakdown
    const allOrders = await db.order.findMany({
      where: { items: { some: { sellerId: sellerProfile.id } } },
      select: { status: true },
    });

    const statusBreakdown: Record<string, number> = {};
    for (const order of allOrders) {
      statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
    }

    // Top products by revenue
    const productRevenue = new Map<string, { title: string; slug: string; quantity: number; revenue: number }>();
    for (const item of orderItems) {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      const existing = productRevenue.get(item.variantId) || {
        title: item.title,
        slug: "",
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += price * item.quantity;
      productRevenue.set(item.variantId, existing);
    }

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Summary stats
    const totalRevenue = orderItems.reduce((sum, item) => {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      return sum + price * item.quantity;
    }, 0);

    const totalUnitsSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueOrders = new Set(orderItems.map((i) => i.order.createdAt.toISOString())).size;
    const avgOrderValue = uniqueOrders > 0 ? totalRevenue / uniqueOrders : 0;

    return NextResponse.json({
      dailySales: last30Days.map((d) => ({
        date: d.date,
        sales: d.sales,
        orderCount: d.orders.size,
      })),
      statusBreakdown,
      topProducts,
      summary: {
        totalRevenue,
        totalUnitsSold,
        totalOrders: uniqueOrders,
        avgOrderValue,
      },
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}