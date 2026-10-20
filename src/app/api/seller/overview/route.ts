// src/app/api/seller/overview/route.ts
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

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    const sellerId = sellerProfile.id;

    // 2. Fetch Orders containing items from this Seller
    const orders = await db.order.findMany({
      where: {
        items: {
          some: {
            sellerId: sellerId
          }
        }
      },
      include: {
        items: {
          where: {
            sellerId: sellerId
          }
        },
        user: {
          select: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Only get the 5 most recent for the "Recent Orders" list
    });

    // 3. Calculate Metrics
    let totalRevenue = 0;
    let totalOrdersCount = 0;
    let pendingOrdersCount = 0;
    const recentOrders = [];

    // We need to fetch ALL orders to get accurate totals, but only return 5 for the UI
    // For performance in production, you might want separate queries for counts vs lists
    const allOrdersForStats = await db.order.findMany({
      where: {
        items: {
          some: {
            sellerId: sellerId
          }
        }
      },
      include: {
        items: {
          where: {
            sellerId: sellerId
          }
        }
      }
    });

    allOrdersForStats.forEach(order => {
      // Calculate revenue specifically for this seller's items in the order
      const sellerSubtotal = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.price.toString()) * item.quantity);
      }, 0);
      
      totalRevenue += sellerSubtotal;
      totalOrdersCount++;
      
      if (order.status === "PENDING") {
        pendingOrdersCount++;
      }
    });

    // Format recent orders for the UI
    orders.forEach(order => {
      const sellerSubtotal = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.price.toString()) * item.quantity);
      }, 0);

      recentOrders.push({
        id: order.id,
        customerName: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
        totalAmount: sellerSubtotal, // Only show the seller's portion
        status: order.status,
        createdAt: order.createdAt,
        itemCount: order.items.length
      });
    });

    return NextResponse.json({
      totalRevenue,
      totalOrders: totalOrdersCount,
      pendingOrders: pendingOrdersCount,
      recentOrders,
      businessName: sellerProfile.businessName
    });

  } catch (error) {
    console.error("Seller overview error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}