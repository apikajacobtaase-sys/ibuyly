import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type GroupedOrderItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string;
  status: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

type SellerOrderGroup = {
  sellerId: string;
  items: GroupedOrderItem[];
  subtotal: number;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        shippingAddress: true,
        items: {
          include: {
            variant: {
              select: { sku: true },
            },
          },
        },
        payment: true,
        refundOperations: {
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    reason: true,
    amount: true,
    currency: true,
    status: true,
    providerReference: true,
    createdAt: true,
    completedAt: true,
  },
},
        shipment: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

       // Group items by seller
    const sellerGroups = new Map<string, SellerOrderGroup>();

    for (const item of order.items) {
      // Some legacy or marketplace order items may not have a seller assigned.
      // Keep those items out of seller-specific groups.
      if (!item.sellerId) {
        continue;
      }

      const sellerId = item.sellerId;

      let existing = sellerGroups.get(sellerId);

      if (!existing) {
        existing = {
          sellerId,
          items: [],
          subtotal: 0,
        };

        sellerGroups.set(sellerId, existing);
      }

      // Prisma Decimal must be converted before arithmetic.
      const price = Number(item.price.toString());
      const itemTotal = price * item.quantity;
existing.items.push({
  id: item.id,
  title: item.title,
  quantity: item.quantity,
  price,
  sku: item.variant?.sku ?? "N/A",
  status: item.status,
  trackingNumber: item.trackingNumber,
  trackingCarrier: item.trackingCarrier,
  shippedAt: item.shippedAt,
  deliveredAt: item.deliveredAt,
});
      existing.subtotal += itemTotal;
    }

    // Fetch seller names
    const sellerIds = Array.from(sellerGroups.keys());
    const sellers = await db.sellerProfile.findMany({
  where: { id: { in: sellerIds } },
  select: {
    id: true,
    businessName: true,
  },
});
    const sellerMap = new Map(sellers.map((s) => [s.id, s.businessName]));

    const groupedItems = Array.from(sellerGroups.values()).map((group) => ({
      sellerId: group.sellerId,
      sellerName: sellerMap.get(group.sellerId) || "Unknown Seller",
      items: group.items,
      subtotal: group.subtotal,
    }));

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        totalAmount: parseFloat(order.totalAmount.toString()),
        createdAt: order.createdAt,
        paymentReference: order.paymentReference,
        customer: {
          id: order.user.id,
          name: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim() || "Unnamed",
          email: order.user.email,
          phone: order.user.phone,
        },
        shippingAddress: order.shippingAddress,
        payment: order.payment ? {
          provider: order.payment.provider,
          amount: parseFloat(order.payment.amount.toString()),
          status: order.payment.status,
          providerTransactionId: order.payment.providerTransactionId,
          createdAt: order.payment.createdAt,
        } : null,
        refundOperations: order.refundOperations.map((refund) => ({
  ...refund,
  amount: Number(refund.amount.toString()),
})),
        shipment: order.shipment ? {
          carrier: order.shipment.carrier,
          trackingNumber: order.shipment.trackingNumber,
          status: order.shipment.status,
          estimatedDelivery: order.shipment.estimatedDelivery,
          actualDelivery: order.shipment.actualDelivery,
        } : null,
        sellerGroups: groupedItems,
      },
    });
  } catch (error) {
    console.error("Admin order detail error:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}


export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Order status is system-managed. Use the dedicated payment, fulfilment, or refund workflow.",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error("Admin order update error:", error);

    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}