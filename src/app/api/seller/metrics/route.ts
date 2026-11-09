import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeSeller } from "@/lib/seller-auth";
import { checkSellerPermission } from "@/lib/permissions";
import { calculateSellerBalance } from "@/lib/finance/accounting";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const RESERVED_PAYOUT_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
];

export async function GET() {
  try {
    const access = await authorizeSeller("view_finances");

    if (!access.authorized) {
      return access.response;
    }

    const [canManageProducts, canManageInventory, seller] =
      await Promise.all([
        checkSellerPermission(
          access.userId,
          access.sellerId,
          "manage_products"
        ),
        checkSellerPermission(
          access.userId,
          access.sellerId,
          "manage_inventory"
        ),
        db.sellerProfile.findFirst({
          where: {
            id: access.sellerId,
            isActive: true,
            verificationStatus: "VERIFIED",
          },
          select: {
            id: true,
            businessName: true,
            commissionRate: true,
          },
        }),
      ]);

    if (!seller) {
      return NextResponse.json(
        { error: "Verified seller profile not found" },
        { status: 403 }
      );
    }

    const now = new Date();
    const chartStart = new Date(now);
    chartStart.setDate(chartStart.getDate() - 29);
    chartStart.setHours(0, 0, 0, 0);

    const [
      financialRecords,
      payouts,
      allOrderItems,
      chartOrderItems,
      offers,
    ] = await Promise.all([
      db.sellerFinancialRecord.findMany({
        where: { sellerId: seller.id },
        select: {
          id: true,
          orderId: true,
          type: true,
          amount: true,
        },
      }),

      db.payout.findMany({
        where: { sellerId: seller.id },
        select: {
          id: true,
          amount: true,
          status: true,
        },
      }),

      db.orderItem.findMany({
        where: { sellerId: seller.id },
        select: {
          orderId: true,
          variantId: true,
          title: true,
          price: true,
          quantity: true,
          status: true,
          order: {
            select: { createdAt: true },
          },
          variant: {
            select: {
              product: {
                select: {
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),

      db.orderItem.findMany({
        where: {
          sellerId: seller.id,
          status: { in: REVENUE_STATUSES },
          order: {
            createdAt: { gte: chartStart },
          },
        },
        select: {
          orderId: true,
          price: true,
          quantity: true,
          order: {
            select: { createdAt: true },
          },
        },
      }),

      canManageInventory
        ? db.sellerOffer.findMany({
            where: { sellerId: seller.id },
            select: {
              id: true,
              sellerSku: true,
              stockQuantity: true,
              variant: {
                select: {
                  sku: true,
                  lowStockThreshold: true,
                  product: {
                    select: {
                      title: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const amountOf = (value: { toNumber(): number } | number) =>
      typeof value === "number" ? value : value.toNumber();

    const balance = calculateSellerBalance(
      financialRecords.map((record) => ({
        id: record.id,
        type: record.type as
          | "SALE"
          | "FEE"
          | "DISCOUNT"
          | "REFUND"
          | "FEE_REVERSAL"
          | "DISCOUNT_REVERSAL"
          | "ADJUSTMENT"
          | "PAYOUT",
        amount: amountOf(record.amount),
      })),
      payouts.map((payout) => ({
        id: payout.id,
        amount: amountOf(payout.amount),
        status: payout.status as
          | "PENDING"
          | "APPROVED"
          | "PROCESSING"
          | "PAID"
          | "REJECTED"
          | "FAILED",
      }))
    );

    const grossRevenue = financialRecords
      .filter((record) => record.type === "SALE")
      .reduce((sum, record) => sum + amountOf(record.amount), 0);

    const revenueItems = allOrderItems.filter((item) =>
      REVENUE_STATUSES.includes(item.status)
    );

    const allOrderIds = new Set(
      allOrderItems.map((item) => item.orderId)
    );

    const pendingOrderIds = new Set(
      allOrderItems
        .filter((item) => item.status === "PENDING")
        .map((item) => item.orderId)
    );

    const saleOrderIds = new Set(
      financialRecords
        .filter((record) => record.type === "SALE" && record.orderId)
        .map((record) => record.orderId as string)
    );

    const summary = {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      netEarnings: Number(balance.earnedBalance.toFixed(2)),
      totalOrders: allOrderIds.size,
      avgOrderValue: saleOrderIds.size > 0
        ? Number((grossRevenue / saleOrderIds.size).toFixed(2))
        : 0,
      pendingOrders: pendingOrderIds.size,
      commissionRate: amountOf(seller.commissionRate),
    };

    const revenueByDay = new Map<
      string,
      { revenue: number; orderIds: Set<string> }
    >();

    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(chartStart);
      date.setDate(chartStart.getDate() + offset);

      const key = date.toISOString().slice(0, 10);

      revenueByDay.set(key, {
        revenue: 0,
        orderIds: new Set(),
      });
    }

    for (const item of chartOrderItems) {
      const key = item.order.createdAt.toISOString().slice(0, 10);
      const day = revenueByDay.get(key);

      if (!day) continue;

      day.revenue += amountOf(item.price) * item.quantity;
      day.orderIds.add(item.orderId);
    }

    const revenueChart = Array.from(revenueByDay.entries()).map(
      ([date, data]) => ({
        date,
        revenue: Number(data.revenue.toFixed(2)),
        orders: data.orderIds.size,
      })
    );

    const productSales = new Map<
      string,
      {
        id: string;
        title: string;
        slug: string;
        unitsSold: number;
        revenue: number;
      }
    >();

    for (const item of revenueItems) {
      const product = item.variant.product;
      const existing = productSales.get(item.variantId);

      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += amountOf(item.price) * item.quantity;
      } else {
        productSales.set(item.variantId, {
          id: item.variantId,
          title: product.title || item.title,
          slug: product.slug,
          unitsSold: item.quantity,
          revenue: amountOf(item.price) * item.quantity,
        });
      }
    }

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((product) => ({
        ...product,
        revenue: Number(product.revenue.toFixed(2)),
      }));

    const lowStock = offers
      .filter(
        (offer) =>
          offer.stockQuantity <= offer.variant.lowStockThreshold
      )
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 10)
      .map((offer) => ({
        id: offer.id,
        sku: offer.sellerSku || offer.variant.sku,
        stockQuantity: offer.stockQuantity,
        productTitle: offer.variant.product.title,
        productSlug: offer.variant.product.slug,
      }));

    return NextResponse.json({
      summary,
      revenueChart,
      topProducts,
      lowStock,
      businessName: seller.businessName,
    });
  } catch (error) {
    console.error("[SELLER METRICS] GET error:", error);

    return NextResponse.json(
      { error: "Failed to load seller dashboard metrics" },
      { status: 500 }
    );
  }
}