import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";

export async function GET() {
  try {
    const access = await authorizeSeller("view_finances");

    if (!access.authorized) return access.response;

    const sellerId = access.sellerId;

    const [
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts,
      recentOrders,
      allOrderItems,
      pendingOrderCount,
      totalOrders,
    ] = await Promise.all([
      db.product.count({ where: { sellerId } }),

      db.product.count({
        where: { sellerId, status: "ACTIVE" },
      }),

      db.product.count({
        where: { sellerId, status: "DRAFT" },
      }),

      db.sellerOffer.findMany({
        where: {
          sellerId,
          stockQuantity: { gt: 0 },
        },
        include: {
          variant: {
            include: {
              product: {
                select: { title: true, slug: true },
              },
            },
          },
        },
        orderBy: { stockQuantity: "asc" },
        take: 5,
      }),

      db.order.findMany({
        where: {
          items: { some: { sellerId } },
          status: {
            in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"],
          },
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
          order: {
            status: {
              in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"],
            },
          },
        },
      }),

      db.order.count({
        where: {
          items: { some: { sellerId } },
          status: "PENDING",
        },
      }),

      db.order.count({
        where: {
          items: { some: { sellerId } },
        },
      }),
    ]);

    const totalSales = allOrderItems.reduce((sum, item) => {
      return sum + Number(item.price) * item.quantity;
    }, 0);

    const productSales = new Map<
      string,
      { title: string; slug: string; quantity: number; revenue: number }
    >();

    for (const item of allOrderItems) {
      const existing = productSales.get(item.variantId) ?? {
        title: item.title || "Unknown Product",
        slug: "",
        quantity: 0,
        revenue: 0,
      };

      const revenue = Number(item.price) * item.quantity;

      existing.quantity += item.quantity;
      existing.revenue += revenue;

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

      lowStockProducts: lowStockProducts.map((offer) => ({
        variantId: offer.variantId,
        offerId: offer.id,
        productTitle: offer.variant.product.title,
        productSlug: offer.variant.product.slug,
        stockQuantity: offer.stockQuantity,
        threshold: offer.variant.lowStockThreshold ?? 5,
      })),

      recentOrders: recentOrders.map((order) => {
        const sellerItems = order.items;
        const subtotal = sellerItems.reduce(
          (sum, item) => sum + Number(item.price) * item.quantity,
          0
        );

        return {
          id: order.id,
          status: order.status,
          createdAt: order.createdAt,
          itemCount: sellerItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          ),
          subtotal,
        };
      }),

      bestProducts,
    });
  } catch (error) {
    console.error("Seller stats error:", error);

    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}