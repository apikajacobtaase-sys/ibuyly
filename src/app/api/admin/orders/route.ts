// src/app/api/admin/orders/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const whereClause: any = {
      paymentReference: { not: null }, // Only show paid orders
    };

    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { shippingAddress: { recipientName: { contains: search, mode: "insensitive" } } },
        { shippingAddress: { phone: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Filter by OrderItem status if provided
    if (status && status !== "ALL") {
      whereClause.items = {
        some: { status: status },
      };
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: whereClause,
        include: {
          shippingAddress: {
            select: { 
              recipientName: true, 
              phone: true, 
              locality: { select: { name: true } }, 
              region: { select: { name: true } } 
            },
          },
          items: {
            include: {
              variant: {
                select: {
                  product: {
                    select: {
                      title: true,
                      images: { take: 1, select: { url: true } },
                      seller: { select: { businessName: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.order.count({ where: whereClause }),
    ]);

    const formattedOrders = orders.map((order: any) => {
      const itemStatuses = order.items.map((item: any) => item.status);
      let overallStatus = "PROCESSING";
      if (itemStatuses.every((s: string) => s === "DELIVERED")) overallStatus = "DELIVERED";
      else if (itemStatuses.some((s: string) => s === "SHIPPED")) overallStatus = "SHIPPED";
      else if (itemStatuses.some((s: string) => s === "CANCELLED")) overallStatus = "CANCELLED";

      return {
        id: order.id,
        createdAt: order.createdAt,
        totalAmount: Number(order.totalAmount),
        customerName: order.shippingAddress?.recipientName || "Unknown",
        customerPhone: order.shippingAddress?.phone || "N/A",
        location: `${order.shippingAddress?.locality?.name || ""}, ${order.shippingAddress?.region?.name || ""}`,
        overallStatus,
        itemCount: order.items.length,
        items: order.items.map((item: any) => ({
          id: item.id,
          title: item.variant?.product?.title || "Product",
          sellerName: item.variant?.product?.seller?.businessName || "Unknown",
          status: item.status,
          trackingNumber: item.trackingNumber,
          trackingCarrier: item.trackingCarrier,
        })),
      };
    });

    return NextResponse.json({
      orders: formattedOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("🚨 Admin orders GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch orders" }, { status: 500 });
  }
}