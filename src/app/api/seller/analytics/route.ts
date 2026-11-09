import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

export async function GET() {
  try {
    const access = await authorizeSeller("view_finances");
    if (!access.authorized) return access.response;

    const sellerId = access.sellerId;

    const [orderItems, allSellerItems] = await Promise.all([
      db.orderItem.findMany({
        where: {
          sellerId,
          status: { in: REVENUE_STATUSES },
        },
        select: {
          id: true,
          orderId: true,
          variantId: true,
          title: true,
          price: true,
          quantity: true,
          order: {
            select: { createdAt: true },
          },
        },
      }),

      db.orderItem.findMany({
        where: { sellerId },
        select: {
          orderId: true,
          status: true,
        },
      }),
    ]);

    const now = new Date();
    const last30Days: {
      date: string;
      sales: number;
      orders: Set<string>;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const dateStr = date.toISOString().split("T")[0];

      last30Days.push({
        date: dateStr,
        sales: 0,
        orders: new Set<string>(),
      });
    }

    for (const item of orderItems) {
      const itemTotal = Number(item.price) * item.quantity;
      const orderDate = item.order.createdAt.toISOString().split("T")[0];

      const dayEntry = last30Days.find(
        (day) => day.date === orderDate
      );

      if (dayEntry) {
        dayEntry.sales += itemTotal;
        dayEntry.orders.add(item.orderId);
      }
    }

    const statusOrders = new Map<string, Set<string>>();

    for (const item of allSellerItems) {
      const status = item.status || "PENDING";

      if (!statusOrders.has(status)) {
        statusOrders.set(status, new Set<string>());
      }

      statusOrders.get(status)!.add(item.orderId);
    }

    const statusBreakdown: Record<string, number> = {};

    for (const [status, orderIds] of statusOrders) {
      statusBreakdown[status] = orderIds.size;
    }

    const productRevenue = new Map<
      string,
      { title: string; quantity: number; revenue: number }
    >();

    for (const item of orderItems) {
      const price = Number(item.price);
      const existing = productRevenue.get(item.variantId) || {
        title: item.title,
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += item.quantity;
      existing.revenue += price * item.quantity;

      productRevenue.set(item.variantId, existing);
    }

    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((product) => ({
        ...product,
        revenue: Number(product.revenue.toFixed(2)),
      }));

    const totalRevenue = orderItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const totalUnitsSold = orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const uniqueOrders = new Set(
      orderItems.map((item) => item.orderId)
    ).size;

    const avgOrderValue =
      uniqueOrders > 0 ? totalRevenue / uniqueOrders : 0;

    return NextResponse.json({
      dailySales: last30Days.map((day) => ({
        date: day.date,
        sales: Number(day.sales.toFixed(2)),
        orderCount: day.orders.size,
      })),
      statusBreakdown,
      topProducts,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalUnitsSold,
        totalOrders: uniqueOrders,
        avgOrderValue: Number(avgOrderValue.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("[SELLER ANALYTICS] GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}