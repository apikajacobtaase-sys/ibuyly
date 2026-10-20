// src/app/api/seller/orders/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendShippingUpdateEmail, sendDeliveryConfirmationEmail } from "@/lib/email";
import { z } from "zod";

const UpdateItemSchema = z.object({
  itemId: z.string().cuid("Invalid item ID"),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  trackingNumber: z.string().optional(),
  trackingCarrier: z.string().optional(),
});

// ==========================================
// GET: Fetch orders containing seller's items
// ==========================================
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const itemStatus = searchParams.get("itemStatus");

    const skip = (page - 1) * limit;

    const whereClause: any = {
      items: {
        some: { sellerId: sellerProfile.id },
      },
    };

    if (itemStatus && itemStatus !== "ALL") {
      whereClause.items.some.status = itemStatus;
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: whereClause,
        include: {
          // ✅ User only has: id, email, emailVerified, hashedPassword, role, createdAt, updatedAt
          user: {
            select: { id: true, email: true },
          },
          // ✅ Address has: recipientName, phone, neighbourhood, + relations
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
          // ✅ Only this seller's items
          items: {
            where: { sellerId: sellerProfile.id },
            include: {
              // ✅ ProductVariant has: sku, price, stockQuantity, etc.
              variant: {
                select: {
                  sku: true,
                  // ✅ Product has: title, slug, description, status
                  product: {
                    select: {
                      title: true,
                      slug: true,
                      // ✅ ProductImage has: id, url
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

       // Format data for frontend
    const formattedOrders = orders.map((order) => {
      // 👇 Prioritize the Snapshot, fallback to relational Address
      const recipient = order.deliveryRecipient || order.shippingAddress?.recipientName || "Customer";
      const phone = order.deliveryPhone || order.shippingAddress?.phone || "N/A";
      
      let addressString = "No address provided";
      if (order.deliveryLocality) {
        addressString = `${order.deliveryStreet || ''}, ${order.deliveryLandmark ? order.deliveryLandmark + ', ' : ''}${order.deliveryLocality}, ${order.deliveryDistrict}, ${order.deliveryRegion}`;
      } else if (order.shippingAddress) {
        addressString = `${order.shippingAddress.neighbourhood || ''}, ${order.shippingAddress.locality?.name || ''}, ${order.shippingAddress.region?.name || ''}`;
      }

      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod || "Online",
        customerName: recipient,
        customerEmail: order.user?.email || "N/A",
        customerPhone: phone,
        shippingAddress: addressString,
        totalAmount: Number(order.totalAmount),
        deliveryFee: Number(order.deliveryFee),
        items: order.items.map((item) => {
          const productImage = item.variant?.product?.images?.[0]?.url || null;
          const productTitle = item.variant?.product?.title || item.title;
          return {
            id: item.id,
            title: productTitle,
            quantity: item.quantity,
            price: Number(item.price),
            status: item.status,
            trackingNumber: item.trackingNumber,
            trackingCarrier: item.trackingCarrier,
            shippedAt: item.shippedAt,
            deliveredAt: item.deliveredAt,
            imageUrl: productImage,
            sku: item.variant?.sku || "N/A",
          };
        }),
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
    console.error("🚨 Fetch seller orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

// ==========================================
// PATCH: Update a specific order item's status/tracking
// ==========================================
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { itemId, status, trackingNumber, trackingCarrier } = validation.data;
       // 🔒 SECURITY: Verify this item belongs to THIS seller
    const orderItem = await db.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: {
          include: { // 👈 Changed from 'select' to 'include' to fetch relations
            user: { 
              select: { 
                email: true, 
                firstName: true, 
                lastName: true 
              } 
            },
            items: {
              select: {
                title: true,
                quantity: true,
              }
            }
          },
        },
      },
    });

    if (!orderItem || orderItem.sellerId !== sellerProfile.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this item" }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (trackingCarrier !== undefined) updateData.trackingCarrier = trackingCarrier;

    // Auto-set timestamps based on status
    if (status === "SHIPPED") {
      updateData.shippedAt = new Date();
    }
    if (status === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    // Update the item
    await db.orderItem.update({
      where: { id: itemId },
      data: updateData,
    });

     // 🔔 CREATE NOTIFICATION FOR CUSTOMER
    if (status && ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(status)) {
      const orderShortId = orderItem.order.id.slice(-8).toUpperCase();
      
      let title = "";
      let message = "";
      
      switch (status) {
        case "CONFIRMED":
          title = `Order #${orderShortId} Confirmed ✅`;
          message = "The seller has confirmed your order and is preparing it for dispatch.";
          break;
        case "PROCESSING":
          title = `Order #${orderShortId} is Being Processed 📦`;
          message = "The seller is currently packing your items.";
          break;
        case "SHIPPED":
          title = `Order #${orderShortId} Has Been Shipped! 🚚`;
          message = trackingNumber 
            ? `Track your package: ${trackingNumber}${trackingCarrier ? ` via ${trackingCarrier}` : ""}`
            : "Your package is on its way! You will be notified when it arrives.";
          break;
        case "DELIVERED":
          title = `Order #${orderShortId} Delivered! 🎉`;
          message = "We hope you enjoy your purchase. Consider leaving a review for the seller!";
          break;
        case "CANCELLED":
          title = `Item in Order #${orderShortId} Cancelled ❌`;
          message = "Please contact support or the seller if you have questions about a refund.";
          break;
      }

      // Create the in-app notification matching your exact schema
      await db.notification.create({
        data: {
          userId: orderItem.order.userId,
          sellerId: sellerProfile.id, // Matches your SellerProfile relation
          type: "ORDER",              // Matches your type string
          title,
          message,
          link: `/account/orders/${orderItem.order.id}`, // Points customer to the specific order
          isRead: false,
        },
      });
    }
    // 👇 NEW: Trigger Email for SHIPPED or DELIVERED
      if (status === "SHIPPED" || status === "DELIVERED") {
        const customerName = `${orderItem.order.user.firstName || ""} ${orderItem.order.user.lastName || ""}`.trim() || "Valued Customer";
        const orderItems = orderItem.order.items.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
        }));

        if (status === "SHIPPED") {
          await sendShippingUpdateEmail({
            to: orderItem.order.user.email,
            customerName,
            orderId: orderItem.order.id,
            trackingNumber,
            carrier: trackingCarrier,
            items: orderItems,
          });
        } else if (status === "DELIVERED") {
          await sendDeliveryConfirmationEmail({
            to: orderItem.order.user.email,
            customerName,
            orderId: orderItem.order.id,
          });
        }
      }
    return NextResponse.json({ success: true, message: "Item updated successfully" });
  } catch (error: any) {
    console.error("🚨 Update order item error:", error);
    return NextResponse.json({ error: error.message || "Failed to update item" }, { status: 500 });
  }
}