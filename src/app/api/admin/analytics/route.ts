// src/app/api/admin/analytics/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
 import { isAdmin } from "@/lib/permissions";
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isAdmin(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all completed orders from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                product: {
                  select: {
                    title: true,
                    sellerId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Daily GMV and revenue
    const dailyData: { date: string; gmv: number; revenue: number; orders: Set<string> }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyData.push({ date: dateStr, gmv: 0, revenue: 0, orders: new Set() });
    }

    // Top sellers and products
    const sellerRevenue = new Map<string, number>();
    const productRevenue = new Map<string, { title: string; revenue: number; quantity: number }>();

    for (const order of orders) {
      const dateStr = order.createdAt.toISOString().split("T")[0];
      const dayEntry = dailyData.find((d) => d.date === dateStr);
      if (!dayEntry) continue;

      dayEntry.orders.add(order.id);
      const orderTotal = parseFloat(order.totalAmount.toString());
      dayEntry.gmv += orderTotal;

      for (const item of order.items) {
        const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
        const itemTotal = price * item.quantity;
        
        // Approximate revenue (use 5% default commission)
        dayEntry.revenue += itemTotal * 0.05;

        // Track seller revenue
        const currentSellerRev = sellerRevenue.get(item.sellerId) || 0;
        sellerRevenue.set(item.sellerId, currentSellerRev + itemTotal);

        // Track product revenue
        const currentProduct = productRevenue.get(item.variantId) || {
          title: item.title,
          revenue: 0,
          quantity: 0,
        };
        currentProduct.revenue += itemTotal;
        currentProduct.quantity += item.quantity;
        productRevenue.set(item.variantId, currentProduct);
      }
    }

    // Get top sellers names
    const topSellerIds = Array.from(sellerRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const topSellers = await db.sellerProfile.findMany({
      where: { id: { in: topSellerIds } },
      select: { id: true, businessName: true },
    });

    const topSellersData = topSellerIds.map((id) => {
      const seller = topSellers.find((s) => s.id === id);
      return {
        sellerId: id,
        businessName: seller?.businessName || "Unknown",
        revenue: sellerRevenue.get(id) || 0,
      };
    });

    // Top products
    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Total metrics
    const totalGMV = dailyData.reduce((sum, d) => sum + d.gmv, 0);
    const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = dailyData.reduce((sum, d) => sum + d.orders.size, 0);
    const avgOrderValue = totalOrders > 0 ? totalGMV / totalOrders : 0;

    return NextResponse.json({
      daily: dailyData.map((d) => ({
        date: d.date,
        gmv: d.gmv,
        revenue: d.revenue,
        orderCount: d.orders.size,
      })),
      topSellers: topSellersData,
      topProducts,
      totals: {
        gmv: totalGMV,
        revenue: totalRevenue,
        orders: totalOrders,
        avgOrderValue,
      },
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}