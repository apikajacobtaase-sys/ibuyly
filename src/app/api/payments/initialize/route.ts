 // src/app/api/payments/initialize/route.ts

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { InitializePaymentSchema } from "@/lib/validators/payment";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    // 1. Authenticate the customer.
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate the request.
    const body = await req.json();
    const parseResult = InitializePaymentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { email, shippingAddressId, items } = parseResult.data;

    // 3. Verify that the shipping address belongs to this customer.
    const address = await db.address.findFirst({
      where: {
        id: shippingAddressId,
        userId: session.user.id,
      },
    });

    if (!address) {
      return NextResponse.json(
        { error: "Shipping address not found" },
        { status: 404 }
      );
    }

    // 4. Determine delivery eligibility and applicable delivery zone.
    const localityCheck = await db.locality.findUnique({
      where: { id: address.localityId },
      include: {
        deliveryZones: {
          where: {
            deliveryZone: {
              status: { in: ["ACTIVE", "RESTRICTED"] },
            },
          },
          include: {
            deliveryZone: true,
          },
        },
      },
    });

    if (!localityCheck || localityCheck.deliveryZones.length === 0) {
      return NextResponse.json(
        {
          error:
            "Delivery is not available to this address. Please select a different address.",
        },
        { status: 400 }
      );
    }

    const deliveryZone =
      localityCheck.deliveryZones[0].deliveryZone;

    // 5. Validate the requested payment method against zone rules.
    const requestedPaymentMethod = body.paymentMethod;

    if (
      requestedPaymentMethod === "COD" &&
      !deliveryZone.codEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "Cash on Delivery is not available for this delivery address. Please choose online payment.",
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentMethod === "PAYSTACK" &&
      !deliveryZone.onlinePayEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "Online payment is currently unavailable for this delivery address.",
        },
        { status: 400 }
      );
    }

    // This endpoint creates a Paystack payment.
    // Reject unsupported payment methods rather than silently charging online.
    if (requestedPaymentMethod !== "PAYSTACK") {
      return NextResponse.json(
        {
          error:
            "This endpoint supports Paystack payments only.",
        },
        { status: 400 }
      );
    }

    const deliveryFee = deliveryZone.baseDeliveryFee.toNumber();

    // 6. Fetch active products and their active variants.
    const productIds = [...new Set(items.map((item) => item.productId))];

    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerId: true,
        title: true,
        variants: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            price: true,
            stockQuantity: true,
          },
        },
      },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    // 7. Validate stock and calculate the product subtotal.
    const orderItemsData: Array<{
      variantId: string;
      sellerId: string;
      title: string;
      quantity: number;
      price: number;
    }> = [];

    let productSubtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json(
          {
            error: `Product not found or inactive: ${item.productId}`,
          },
          { status: 400 }
        );
      }

      if (!product.sellerId) {
        return NextResponse.json(
          {
            error: `Product "${product.title}" has no assigned seller and cannot be purchased.`,
          },
          { status: 400 }
        );
      }

      const variant = product.variants[0];

      if (!variant) {
        return NextResponse.json(
          {
            error: `No active variant for product: ${product.title}`,
          },
          { status: 400 }
        );
      }

      if (variant.stockQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.title}". Only ${variant.stockQuantity} available.`,
          },
          { status: 400 }
        );
      }

      const unitPrice = variant.price.toNumber();
      productSubtotal += unitPrice * item.quantity;

      orderItemsData.push({
        variantId: variant.id,
        sellerId: product.sellerId,
        title: product.title,
        quantity: item.quantity,
        price: unitPrice,
      });
    }

    // Add delivery exactly once, after calculating the product subtotal.
    const subtotalWithDelivery = productSubtotal + deliveryFee;

    // 8. Validate the delivery zone's minimum product order.
    if (
      deliveryZone.minOrderValue &&
      productSubtotal < deliveryZone.minOrderValue.toNumber()
    ) {
      return NextResponse.json(
        {
          error: `Orders to this area require a minimum product value of GH₵${deliveryZone.minOrderValue.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // 9. Validate and calculate any voucher discount.
    let discountAmount = 0;
    let appliedVoucherId: string | null = null;

    if (body.voucherCode) {
      const voucher = await db.voucher.findUnique({
        where: {
          code: String(body.voucherCode).trim().toUpperCase(),
        },
      });

      if (voucher && voucher.isActive) {
        const now = new Date();

        const isValidDate =
          (!voucher.startsAt || now >= voucher.startsAt) &&
          (!voucher.expiresAt || now <= voucher.expiresAt);

        const hasUsageLeft =
          !voucher.usageLimit ||
          voucher.usedCount < voucher.usageLimit;

        const meetsMinOrder =
          !voucher.minOrderAmount ||
          productSubtotal >= voucher.minOrderAmount.toNumber();

        if (isValidDate && hasUsageLeft && meetsMinOrder) {
          if (voucher.type === "PERCENTAGE") {
            // Calculate percentage discounts on products, not delivery.
            discountAmount =
              (productSubtotal * voucher.value.toNumber()) / 100;

            if (
              voucher.maxDiscount &&
              discountAmount > voucher.maxDiscount.toNumber()
            ) {
              discountAmount = voucher.maxDiscount.toNumber();
            }
          } else if (voucher.type === "FIXED") {
            discountAmount = Math.min(
              voucher.value.toNumber(),
              productSubtotal
            );
          }

          appliedVoucherId = voucher.id;
        }
      }
    }

    // Never allow a voucher to reduce the amount below the delivery fee.
    discountAmount = Math.min(
      Math.max(0, discountAmount),
      productSubtotal
    );

    const finalTotal = Math.max(
      0,
      subtotalWithDelivery - discountAmount
    );

    // 10. Generate a unique payment reference.
    const reference = `IBUY-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

    // 11. Create the order and payment, and decrement stock atomically.
    const order = await db.$transaction(
      async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            userId: session.user.id,
            shippingAddressId,
            totalAmount: finalTotal,
            deliveryFee,
            status: "PENDING",
            paymentReference: reference,
          },
        });

        await tx.orderItem.createMany({
          data: orderItemsData.map((item) => ({
            orderId: newOrder.id,
            variantId: item.variantId,
            sellerId: item.sellerId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            provider: "PAYSTACK",
            amount: finalTotal,
            currency: "GHS",
            status: "PENDING",
            metadata: {
              reference,
              email,
              discountApplied: discountAmount > 0,
            },
          },
        });

        if (appliedVoucherId) {
          await tx.voucher.update({
            where: { id: appliedVoucherId },
            data: {
              usedCount: { increment: 1 },
            },
          });
        }

        for (const item of orderItemsData) {
          // Conditional update prevents stock from becoming negative
          // if another customer buys the item concurrently.
          const stockUpdate = await tx.productVariant.updateMany({
            where: {
              id: item.variantId,
              stockQuantity: { gte: item.quantity },
            },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });

          if (stockUpdate.count !== 1) {
            throw new Error(
              `Insufficient stock for "${item.title}". Please try again.`
            );
          }
        }

        return newOrder;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // 12. Return the server-calculated totals.
    return NextResponse.json({
      success: true,
      orderId: order.id,
      reference,
      deliveryFee,
      amount: Math.round(finalTotal * 100),
      productSubtotal,
      subtotalWithDelivery,
      discountAmount,
      finalTotal,
    });
  } catch (error: unknown) {
    console.error("Payment initialization error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Duplicate payment reference. Please try again." },
          { status: 409 }
        );
      }

      if (error.code === "P2025") {
        return NextResponse.json(
          {
            error:
              "A referenced record was not found. Stock may have changed.",
          },
          { status: 409 }
        );
      }

      if (error.code === "P2034") {
        return NextResponse.json(
          {
            error:
              "The order could not be completed because inventory changed. Please try again.",
          },
          { status: 409 }
        );
      }
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Insufficient stock")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to initialize payment. Please try again." },
      { status: 500 }
    );
  }
}