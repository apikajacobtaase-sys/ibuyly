 // src/app/api/seller/orders/[id]/route.ts

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getOrderShippedEmail } from "@/emails/order-shipped";
import { getReviewRequestEmail } from "@/emails/review-request";

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const ALLOWED_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

// GET: Fetch a seller's portion of an order
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json(
        { error: "Seller profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shippingAddress: true,
        items: {
          where: { sellerId: sellerProfile.id },
          include: {
            variant: {
              select: { sku: true },
            },
          },
        },
        shipment: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Convert Prisma Decimal values to JavaScript numbers.
    const sellerTotal = order.items.reduce((sum, item) => {
      return sum + Number(item.price) * item.quantity;
    }, 0);

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        customerName:
          `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim() ||
          order.user.email,
        customerEmail: order.user.email,
        customerPhone: order.user.phone,
        shippingAddress: order.shippingAddress,
        sellerTotal,
        trackingNumber: order.shipment?.trackingNumber || "",
        carrier: order.shipment?.carrier || "",
        items: order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: Number(item.price),
          sku: item.variant?.sku || "N/A",
        })),
      },
    });
  } catch (error) {
    console.error("Seller order GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// PATCH: Update order status and shipment information
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json(
        { error: "Seller profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;

    const body = await req.json();

    const status = body.status as string | undefined;
    const trackingNumber = body.trackingNumber as string | undefined;
    const carrier = body.carrier as string | undefined;

    // Validate the requested status before sending it to Prisma.
    if (status && !ALLOWED_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: "Invalid order status" },
        { status: 400 }
      );
    }

    if (
      (trackingNumber !== undefined && typeof trackingNumber !== "string") ||
      (carrier !== undefined && typeof carrier !== "string")
    ) {
      return NextResponse.json(
        { error: "Tracking number and carrier must be strings" },
        { status: 400 }
      );
    }

    // Verify that this seller owns items in the requested order.
    const hasItems = await db.orderItem.count({
      where: {
        orderId: id,
        sellerId: sellerProfile.id,
      },
    });

    if (!hasItems) {
      return NextResponse.json(
        { error: "Unauthorized to update this order" },
        { status: 403 }
      );
    }

    // Only update shipment information when tracking details are supplied
    // or the status change requires a shipment status update.
    const shouldUpdateShipment =
      Boolean(trackingNumber) ||
      Boolean(carrier) ||
      status === "SHIPPED" ||
      status === "DELIVERED";

    // Update the order and shipment atomically.
    await db.$transaction(async (tx) => {
      if (status) {
        await tx.order.update({
          where: { id },
          data: { status: status as OrderStatus },
        });
      }

      if (shouldUpdateShipment) {
        const existingShipment = await tx.shipment.findUnique({
          where: { orderId: id },
        });

        const shipmentStatus =
          status === "SHIPPED"
            ? "IN_TRANSIT"
            : status === "DELIVERED"
              ? "DELIVERED"
              : undefined;

        if (existingShipment) {
          await tx.shipment.update({
            where: { orderId: id },
            data: {
              ...(trackingNumber !== undefined && { trackingNumber }),
              ...(carrier !== undefined && { carrier }),
              ...(shipmentStatus && { status: shipmentStatus }),
            },
          });
        } else {
          await tx.shipment.create({
            data: {
              orderId: id,
              trackingNumber: trackingNumber || "",
              carrier: carrier || "",
              status: shipmentStatus || "PENDING",
            },
          });
        }
      }
    });

    // Send customer emails only after the database transaction succeeds.
    // Email failures should not undo a successful order update.
    if (status === "SHIPPED" || status === "DELIVERED") {
      try {
        const fullOrder = await db.order.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
              },
            },
            shippingAddress: {
              select: {
                recipientName: true,
              },
            },
            shipment: true,
          },
        });

        const customerEmail = fullOrder?.user.email;

        const customerName =
          fullOrder?.shippingAddress?.recipientName ||
          fullOrder?.user.firstName ||
          "Customer";

        if (customerEmail && status === "SHIPPED" && trackingNumber) {
          const html = getOrderShippedEmail({
            customerName,
            orderId: id,
            trackingNumber,
            trackingCarrier: carrier || fullOrder?.shipment?.carrier || "",
          });

          await sendEmail({
            to: customerEmail,
            subject: `Your iBUY Order #${id.slice(-8).toUpperCase()} has shipped!`,
            html,
          });
        }

        if (customerEmail && status === "DELIVERED") {
          const html = getReviewRequestEmail({
            customerName,
            orderId: id,
          });

          await sendEmail({
            to: customerEmail,
            subject: `Your iBUY Order #${id.slice(-8).toUpperCase()} has been delivered!`,
            html,
          });
        }
      } catch (emailError) {
        console.error("Order status email failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Seller order PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}