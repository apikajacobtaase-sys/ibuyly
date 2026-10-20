 // src/app/api/seller/metrics/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get the Seller Profile ID
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, businessName: true }
    });

    // ✅ FIX: If no profile exists (e.g., after DB reset), return zeros
    if (!sellerProfile) {
      return NextResponse.json({
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        recentOrders: [],
        businessName: "New Seller"
      });
    }

    const sellerId = sellerProfile.id;

    // 2. Fetch Orders
    const allOrders = await db.order.findMany({
      where: {
        items: {
          some: { sellerId: sellerId }
        }
      },
      include: {
        items: { where: { sellerId: sellerId } },
        user: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 3. Calculate Metrics
    let totalRevenue = 0;
    let totalOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    const recentOrders = [];

    allOrders.forEach(order => {
      const sellerSubtotal = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.price.toString()) * item.quantity);
      }, 0);
      
      totalRevenue += sellerSubtotal;
      totalOrders++;
      if (order.status === "PENDING") pendingOrders++;
      if (order.status === "COMPLETED" || order.status === "DELIVERED") completedOrders++;

      recentOrders.push({
        id: order.id,
        customerName: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
        totalAmount: sellerSubtotal,
        status: order.status,
        createdAt: order.createdAt,
        itemCount: order.items.length
      });
    });

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      pendingOrders,
      completedOrders,
      recentOrders,
      businessName: sellerProfile.businessName
    });

  } catch (error: any) {
    console.error("🚨 Seller Metrics Crash:", error);
    // ✅ FIX: Return JSON error to prevent HTML response
    return NextResponse.json(
      { error: "Failed to load dashboard", details: error.message },
      { status: 500 }
    );
  }
}