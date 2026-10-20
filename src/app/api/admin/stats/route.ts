// src/app/api/admin/stats/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    // Then use:
if (!session || !isAdmin(session.user.role)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

    const [
      totalUsers,
      totalCustomers,
      totalSellers,
      verifiedSellers,
      totalProducts,
      activeProducts,
      totalOrders,
      completedOrders,
      pendingApplications,
      pendingPayouts,
      gmvData,
      revenueData,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.sellerProfile.count(),
      db.sellerProfile.count({ where: { verificationStatus: "VERIFIED" } }),
      db.product.count(),
      db.product.count({ where: { status: "ACTIVE" } }),
      db.order.count(),
      db.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } } }),
      db.sellerApplication.count({ where: { status: "PENDING" } }),
      db.payout.count({ where: { status: "PENDING" } }),
      // GMV = total value of all completed orders (NOT revenue)
      db.order.aggregate({
        where: { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
        _sum: { totalAmount: true },
      }),
      // Revenue = sum of marketplace fees (approximated via seller commission)
      db.orderItem.findMany({
        where: {
          order: { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
        },
        include: {
          variant: {
            select: {
              product: {
                select: {
                  seller: { select: { commissionRate: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate actual revenue from commissions
    let totalRevenue = 0;
    for (const item of revenueData) {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      const itemTotal = price * item.quantity;
      const commissionRate = parseFloat(item.variant.product.seller.commissionRate.toString()) / 100;
      totalRevenue += itemTotal * commissionRate;
    }

    return NextResponse.json({
      gmv: gmvData._sum.totalAmount ? parseFloat(gmvData._sum.totalAmount.toString()) : 0,
      revenue: totalRevenue,
      totalUsers,
      totalCustomers,
      totalSellers,
      verifiedSellers,
      totalProducts,
      activeProducts,
      totalOrders,
      completedOrders,
      pendingApplications,
      pendingPayouts,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}