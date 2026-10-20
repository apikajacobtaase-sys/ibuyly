// src/app/api/admin/metrics/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      totalOrders,
      paidOrders,
      todayOrders,
      monthOrders,
      totalCustomers,
      totalSellers,
      pendingSellers,
      activeProducts,
      lowStockVariants,
      revenueLast30Days,
      topSellers,
      recentOrders,
    ] = await Promise.all([
      // 1. Total orders (all time)
      db.order.count(),

      // 2. Paid orders (for GMV calculation)
      db.order.findMany({
        where: {
          paymentReference: { not: null },
        },
        select: {
          totalAmount: true,
          deliveryFee: true,
        },
      }),

      // 3. Today's orders
      db.order.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),

      // 4. This month's orders
      db.order.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // 5. Total customers (✅ VERIFIED: "CUSTOMER")
      db.user.count({
        where: { role: "CUSTOMER" },
      }),

      // 6. Total approved sellers (✅ VERIFIED: "VERIFIED")
      db.sellerProfile.count({
        where: { verificationStatus: "VERIFIED" },
      }),

      // 7. Pending seller applications (✅ VERIFIED: "PENDING")
      db.sellerProfile.count({
        where: { verificationStatus: "PENDING" },
      }),

      // 8. Active products (✅ VERIFIED: "ACTIVE")
      db.product.count({
        where: { status: "ACTIVE" },
      }),

      // 9. Low stock variants (stock < 5)
      db.productVariant.findMany({
        where: {
          stockQuantity: { lt: 5 },
        },
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              seller: { select: { businessName: true } },
            },
          },
        },
        orderBy: { stockQuantity: "asc" },
        take: 10,
      }),

           // 10. Revenue over last 30 days (using snake_case column names)
      db.$queryRaw<any[]>`
        SELECT 
          DATE_TRUNC('day', "created_at")::date as date,
          COALESCE(SUM("total_amount"), 0) as revenue,
          COUNT(*)::int as orders
        FROM "orders"
        WHERE "created_at" >= ${thirtyDaysAgo}
        GROUP BY DATE_TRUNC('day', "created_at")
        ORDER BY date ASC
      `,

      // 11. Top 5 sellers by revenue (using snake_case column names)
      db.$queryRaw<any[]>`
        SELECT 
          sp.id as "sellerId",
          sp."business_name" as "businessName",
          COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
          COUNT(DISTINCT oi."order_id")::int as orders
        FROM "order_items" oi
        JOIN "seller_profiles" sp ON sp.id = oi."seller_id"
        JOIN "orders" o ON o.id = oi."order_id"
        WHERE o."payment_reference" IS NOT NULL
        GROUP BY sp.id, sp."business_name"
        ORDER BY revenue DESC
        LIMIT 5
      `,

      // 12. Recent 10 orders
      db.order.findMany({
        where: { paymentReference: { not: null } },
        include: {
          shippingAddress: {
            select: { recipientName: true },
          },
          items: {
            take: 1,
            select: {
              variant: {
                select: {
                  product: {
                    select: {
                      images: { take: 1, select: { url: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Calculate GMV and platform revenue
    const gmv = paidOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0
    );
    const platformRevenue = paidOrders.reduce(
      (sum, o) => sum + Number(o.deliveryFee),
      0
    );

    // Format revenue chart data (fill in missing days with 0)
    const revenueChart = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = revenueLast30Days.find(
        (d: any) => new Date(d.date).toISOString().split("T")[0] === dateStr
      );
      revenueChart.push({
        date: dateStr,
        revenue: dayData ? Number(dayData.revenue) : 0,
        orders: dayData ? Number(dayData.orders) : 0,
      });
    }

    // Format recent orders with calculated overall status
    const formattedRecentOrders = recentOrders.map((order: any) => {
      const itemStatuses = order.items.map((item: any) => item.status);
      
      let overallStatus = "PROCESSING";
      if (itemStatuses.every((s: string) => s === "DELIVERED")) overallStatus = "DELIVERED";
      else if (itemStatuses.some((s: string) => s === "SHIPPED")) overallStatus = "SHIPPED";
      else if (itemStatuses.some((s: string) => s === "CANCELLED")) overallStatus = "CANCELLED";

      return {
        id: order.id,
        status: overallStatus, // 👈 Now shows actual delivery status
        paidAt: order.createdAt,
        totalAmount: Number(order.totalAmount),
        customerName: order.shippingAddress?.recipientName || "Customer",
        itemCount: order.items.length,
        primaryImage: order.items[0]?.variant?.product?.images?.[0]?.url || null,
      };
    });
    return NextResponse.json({
      summary: {
        gmv,
        platformRevenue,
        totalOrders,
        todayOrders,
        monthOrders,
        totalCustomers,
        totalSellers,
        pendingSellers,
        activeProducts,
      },
      revenueChart,
      topSellers: topSellers.map((s: any) => ({
        sellerId: s.sellerId,
        businessName: s.businessName,
        revenue: Number(s.revenue),
        orders: Number(s.orders),
      })),
      lowStock: lowStockVariants.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        stockQuantity: v.stockQuantity,
        productTitle: v.product.title,
        productSlug: v.product.slug,
        sellerName: v.product.seller?.businessName || "Unknown",
      })),
      recentOrders: formattedRecentOrders,
    });
  } catch (error: any) {
    console.error("🚨 Admin metrics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}