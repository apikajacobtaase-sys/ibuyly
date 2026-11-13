import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendShippingUpdateEmail, sendDeliveryConfirmationEmail } from "@/lib/email";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const ItemStatusSchema = z.enum([
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const UpdateItemSchema = z.object({
  itemId: z.string().cuid("Invalid item ID"),
  status: ItemStatusSchema.optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  trackingCarrier: z.string().trim().max(80).optional(),
}).strict().refine(
  (data) =>
    data.status !== undefined ||
    data.trackingNumber !== undefined ||
    data.trackingCarrier !== undefined,
  { message: "At least one field must be provided" }
);

const ALL_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// ==========================================
// GET: Fetch only this seller's order items
// ==========================================
export async function GET(req: Request) {
  try {
    const access = await authorizeSeller("manage_orders");

    if (!access.authorized) {
      return access.response;
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "10");
    const itemStatus = searchParams.get("itemStatus") ?? "ALL";

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    if (
      itemStatus !== "ALL" &&
      !ALL_STATUSES.includes(itemStatus as typeof ALL_STATUSES[number])
    ) {
      return NextResponse.json(
        { error: "Invalid order item status" },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    const itemWhere = {
      sellerId: access.sellerId,
      ...(itemStatus !== "ALL" ? { status: itemStatus } : {}),
    };

    const whereClause = {
      items: {
        some: itemWhere,
      },
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          payment: {
            select: {
              paymentMethod: true,
            },
          },
          shippingAddress: {
            select: {
              recipientName: true,
              phone: true,
              neighbourhood: true,
              region: { select: { name: true } },
              district: { select: { name: true } },
              locality: { select: { name: true } },
            },
          },
          items: {
            where: {
              sellerId: access.sellerId,
              ...(itemStatus !== "ALL" ? { status: itemStatus } : {}),
            },
            include: {
              variant: {
                select: {
                  sku: true,
                  product: {
                    select: {
                      title: true,
                      slug: true,
                      images: {
                        take: 1,
                        select: { url: true },
                      },
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

    const formattedOrders = orders.map((order) => {
      const recipient =
        order.deliveryRecipient ||
        order.shippingAddress?.recipientName ||
        "Customer";

      const phone =
        order.deliveryPhone ||
        order.shippingAddress?.phone ||
        "N/A";

      let addressString = "No address provided";

      if (order.deliveryLocality) {
        addressString = [
          order.deliveryStreet || "",
          order.deliveryLandmark || "",
          order.deliveryLocality,
          order.deliveryDistrict || "",
          order.deliveryRegion || "",
        ]
          .filter(Boolean)
          .join(", ");
      } else if (order.shippingAddress) {
        addressString = [
          order.shippingAddress.neighbourhood || "",
          order.shippingAddress.locality?.name || "",
          order.shippingAddress.district?.name || "",
          order.shippingAddress.region?.name || "",
        ]
          .filter(Boolean)
          .join(", ");
      }

      const sellerSubtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );

      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        paymentMethod: order.payment?.paymentMethod || "Online",
        customerName: recipient,
        customerEmail: order.user?.email || "N/A",
        customerPhone: phone,
        shippingAddress: addressString,
        sellerSubtotal,
        items: order.items.map((item) => ({
          id: item.id,
          title: item.variant?.product?.title || item.title,
          quantity: item.quantity,
          price: Number(item.price),
          status: item.status,
          trackingNumber: item.trackingNumber,
          trackingCarrier: item.trackingCarrier,
          shippedAt: item.shippedAt,
          deliveredAt: item.deliveredAt,
          imageUrl: item.variant?.product?.images?.[0]?.url || null,
          sku: item.variant?.sku || "N/A",
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
  } catch (error) {
    console.error("Fetch seller orders error:", error);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH: Update a seller-owned order item
// ==========================================
export async function PATCH(req: Request) {
  try {
    const access = await authorizeSeller("manage_orders");

    if (!access.authorized) {
      return access.response;
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = UpdateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      itemId,
      status,
      trackingNumber,
      trackingCarrier,
    } = validation.data;

    // Never retrieve an item belonging to another seller.
    const orderItem = await db.orderItem.findFirst({
      where: {
        id: itemId,
        sellerId: access.sellerId,
      },
      include: {
        order: {
  include: {
    payment: {
      select: {
        status: true,
      },
    },
    user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            items: {
              where: {
                sellerId: access.sellerId,
              },
              select: {
                title: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (!orderItem) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }
    if (
  status === "CANCELLED" &&
  orderItem.order.payment?.status !== "SUCCESSFUL"
) {
  return NextResponse.json(
    {
      error: "This item cannot be cancelled because its payment has not been confirmed.",
    },
    { status: 409 }
  );
}

    const statusChanged =
      status !== undefined && status !== orderItem.status;

    const trackingChanged =
      trackingNumber !== undefined ||
      trackingCarrier !== undefined;

    if (!statusChanged && !trackingChanged) {
      return NextResponse.json(
        { error: "No changes detected" },
        { status: 400 }
      );
    }

    // Enforce forward-only fulfilment transitions.
    if (statusChanged) {
      const allowed = ALLOWED_TRANSITIONS[orderItem.status] || [];

      if (!allowed.includes(status!)) {
        return NextResponse.json(
          {
            error: `Cannot change order item from ${orderItem.status} to ${status}.`,
          },
          { status: 409 }
        );
      }
    }

    // Tracking information can only be edited while shipped.
    const resultingStatus = status ?? orderItem.status;

    if (trackingChanged && resultingStatus !== "SHIPPED") {
      return NextResponse.json(
        {
          error: "Tracking information can only be updated for shipped items.",
        },
        { status: 400 }
      );
    }

    const updateData: {
      status?: string;
      trackingNumber?: string | null;
      trackingCarrier?: string | null;
      shippedAt?: Date;
      deliveredAt?: Date;
    } = {};

    if (statusChanged) {
      updateData.status = status;
    }

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber || null;
    }

    if (trackingCarrier !== undefined) {
      updateData.trackingCarrier = trackingCarrier || null;
    }

    if (statusChanged && status === "SHIPPED") {
      updateData.shippedAt = new Date();
    }

    if (statusChanged && status === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    const finalTrackingNumber =
      trackingNumber !== undefined
        ? trackingNumber || null
        : orderItem.trackingNumber;

    const finalTrackingCarrier =
      trackingCarrier !== undefined
        ? trackingCarrier || null
        : orderItem.trackingCarrier;

    // Update and notify atomically.
    const transactionResult = await db.$transaction(async (tx) => {
      const updated = await tx.orderItem.updateMany({
        where: {
          id: itemId,
          sellerId: access.sellerId,
          status: orderItem.status,
        },
        data: updateData,
      });

      if (updated.count !== 1) {
        return false;
      }
      if (statusChanged && status === "CANCELLED") {
  if (!orderItem.offerId) {
    throw new Error(
      `Order item ${orderItem.id} has no offerId; inventory restoration requires reconciliation.`
    );
  }

  const restored = await tx.sellerOffer.updateMany({
    where: {
      id: orderItem.offerId,
      sellerId: access.sellerId,
    },
    data: {
      stockQuantity: {
        increment: orderItem.quantity,
      },
    },
  });

  if (restored.count !== 1) {
    throw new Error(
      `Could not restore inventory for order item ${orderItem.id}.`
    );
  }
}

      if (statusChanged) {
        const orderShortId = orderItem.order.id
          .slice(-8)
          .toUpperCase();

        let title = "";
        let message = "";

        switch (status) {
          case "CONFIRMED":
            title = `Order #${orderShortId} Confirmed`;
            message =
              "The seller has confirmed your order and is preparing it for dispatch.";
            break;

          case "PROCESSING":
            title = `Order #${orderShortId} is Being Processed`;
            message = "The seller is currently packing your items.";
            break;

          case "SHIPPED":
            title = `Order #${orderShortId} Has Been Shipped!`;
            message = finalTrackingNumber
              ? `Track your package: ${finalTrackingNumber}${finalTrackingCarrier ? ` via ${finalTrackingCarrier}` : ""}`
              : "Your package is on its way! You will be notified when it arrives.";
            break;

          case "DELIVERED":
            title = `Order #${orderShortId} Delivered!`;
            message =
              "We hope you enjoy your purchase. Consider leaving a review for the seller!";
            break;

          case "CANCELLED":
            title = `Item in Order #${orderShortId} Cancelled`;
            message =
              "An item in your order has been cancelled. Please contact support if you need assistance.";
            break;
        }

        await tx.notification.create({
          data: {
            userId: orderItem.order.userId,
            sellerId: access.sellerId,
            type: "ORDER",
            title,
            message,
            link: `/account/orders/${orderItem.order.id}`,
            isRead: false,
          },
              });
      }

      // Synchronize the parent order with fulfilment progress.
      const orderForAggregation = await tx.order.findUnique({
        where: { id: orderItem.order.id },
        select: {
          status: true,
          items: {
            select: {
              status: true,
            },
          },
        },
      });

      // Never override payment-pending, cancelled, or refunded orders.
      if (
        orderForAggregation &&
        ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(
          orderForAggregation.status
        )
      ) {
        const activeItems = orderForAggregation.items.filter(
          (item) => item.status !== "CANCELLED"
        );

        let aggregateStatus:
          | "CONFIRMED"
          | "PROCESSING"
          | "SHIPPED"
          | "DELIVERED"
          | "CANCELLED";

        if (activeItems.length === 0) {
          aggregateStatus = "CANCELLED";
        } else if (
          activeItems.every((item) => item.status === "DELIVERED")
        ) {
          aggregateStatus = "DELIVERED";
        } else if (
          activeItems.every((item) =>
            ["SHIPPED", "DELIVERED"].includes(item.status)
          )
        ) {
          aggregateStatus = "SHIPPED";
        } else if (
          activeItems.every((item) =>
            ["PROCESSING", "SHIPPED", "DELIVERED"].includes(item.status)
          )
        ) {
          aggregateStatus = "PROCESSING";
        } else {
          aggregateStatus = "CONFIRMED";
        }

        await tx.order.updateMany({
          where: {
            id: orderItem.order.id,
            status: orderForAggregation.status,
          },
          data: {
            status: aggregateStatus,
          },
        });
      }

      return true;
    });

    if (!transactionResult) {
      return NextResponse.json(
        { error: "This order item changed. Refresh and try again." },
        { status: 409 }
      );
    }

    // Send email after the database transaction.
    // Email failures must not undo a successful order update.
    if (
      statusChanged &&
      (status === "SHIPPED" || status === "DELIVERED")
    ) {
      try {
        const customerName =
          `${orderItem.order.user.firstName || ""} ${orderItem.order.user.lastName || ""}`.trim() ||
          "Valued Customer";

        const orderItems = orderItem.order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
        }));

        if (status === "SHIPPED") {
          await sendShippingUpdateEmail({
            to: orderItem.order.user.email,
            customerName,
            orderId: orderItem.order.id,
            trackingNumber: finalTrackingNumber ?? undefined,
            carrier: finalTrackingCarrier ?? undefined,
            items: orderItems,
          });
        } else {
          await sendDeliveryConfirmationEmail({
            to: orderItem.order.user.email,
            customerName,
            orderId: orderItem.order.id,
          });
        }
      } catch (emailError) {
        console.error("Order update email failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Item updated successfully",
    });
  } catch (error) {
    console.error("Update seller order item error:", error);

    return NextResponse.json(
      { error: "Failed to update order item" },
      { status: 500 }
    );
  }
}