// src/app/api/seller/orders/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getOrderShippedEmail } from "@/emails/order-shipped";
import { getReviewRequestEmail } from "@/emails/review-request";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!sellerProfile) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        shippingAddress: true,
        items: {
          where: { sellerId: sellerProfile.id },
          include: { variant: { select: { sku: true } } },
        },
        shipment: true,
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const sellerTotal = order.items.reduce((sum, item) => {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      return sum + price * item.quantity;
    }, 0);

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        customerName: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim() || order.user.email,
        customerEmail: order.user.email,
        customerPhone: order.user.phone,
        shippingAddress: order.shippingAddress,
        sellerTotal,
        trackingNumber: order.shipment?.trackingNumber || "",
        carrier: order.shipment?.carrier || "",
        items: order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
          sku: item.variant?.sku || "N/A",
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!sellerProfile) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const { id } = await params;
    const { status, trackingNumber, carrier } = await req.json();

    // Verify seller has items in this order
    const hasItems = await db.orderItem.count({
      where: { orderId: id, sellerId: sellerProfile.id },
    });

    if (!hasItems) {
      return NextResponse.json({ error: "Unauthorized to update this order" }, { status: 403 });
    }

    // Update order status and shipment info in a transaction
    await db.$transaction(async (tx) => {
      if (status) {
        await tx.order.update({
          where: { id },
          data: { status },
        });
      }

      if (trackingNumber || carrier) {
        const existingShipment = await tx.shipment.findUnique({ where: { orderId: id } });
        if (existingShipment) {
          await tx.shipment.update({
            where: { orderId: id },
            data: {
              trackingNumber: trackingNumber || existingShipment.trackingNumber,
              carrier: carrier || existingShipment.carrier,
              status: status === "SHIPPED" ? "IN_TRANSIT" : status === "DELIVERED" ? "DELIVERED" : existingShipment.status,
            },
          });
        } else {
          await tx.shipment.create({
            data: {
              orderId: id,
              trackingNumber: trackingNumber || "",
              carrier: carrier || "",
              status: status === "SHIPPED" ? "IN_TRANSIT" : "PENDING",
            },
          })    // 📧 SEND STATUS UPDATE EMAILS
    try {
      // Fetch the order with customer details for the email
      const fullOrder = await db.order.findUnique({
        where: { id: orderId }, // Replace 'orderId' with your actual order ID variable
        include: {
          user: { select: { email: true, firstName: true } },
          shippingAddress: { select: { recipientName: true } },
        },
      });

      const customerEmail = fullOrder?.user.email;
      const customerName = fullOrder?.shippingAddress?.recipientName || fullOrder?.user.firstName || "Customer";

      if (customerEmail) {
        if (newStatus === "SHIPPED" && trackingNumber) {
          const html = getOrderShippedEmail({
            customerName,
            orderId: orderId,
            trackingNumber,
            trackingCarrier, // Replace with your tracking carrier variable
          });

          sendEmail({
            to: customerEmail,
            subject: `🚚 Your iBUY Order #${orderId.slice(-8).toUpperCase()} has shipped!`,
            html,
          }).catch(err => console.error("Shipping email failed:", err));
        }

        if (newStatus === "DELIVERED") {
          const html = getReviewRequestEmail({
            customerName,
            orderId: orderId,
          });

          sendEmail({
            to: customerEmail,
            subject: `⭐ How was your iBUY Order #${orderId.slice(-8).toUpperCase()}?`,
            html,
          }).catch(err => console.error("Review request email failed:", err));
        }
      }
    } catch (emailError) {
      console.error("Failed to prepare status update email:", emailError);
    };
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}