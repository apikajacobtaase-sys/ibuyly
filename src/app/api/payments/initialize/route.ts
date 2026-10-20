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
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate input with Zod
    const body = await req.json();
    const parseResult = InitializePaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }
    const { email, shippingAddressId, items } = parseResult.data;

    // 3. Verify shipping address belongs to the user
    const address = await db.address.findFirst({
      where: { id: shippingAddressId, userId: session.user.id },
    });
    if (!address) {
      return NextResponse.json({ error: "Shipping address not found" }, { status: 404 });
    }
        // 3b. DELIVERY ELIGIBILITY CHECK (Server-authoritative)
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
        { error: "Delivery is not available to this address. Please select a different address." },
        { status: 400 }
      );
    }
        // Validate Payment Method against Zone Rules
    const requestedPaymentMethod = body.paymentMethod; // e.g., "COD" or "PAYSTACK"
    
    if (requestedPaymentMethod === "COD" && !deliveryZone.codEnabled) {
      return NextResponse.json(
        { error: "Cash on Delivery is not available for this delivery address. Please choose online payment." },
        { status: 400 }
      );
    }

    if (requestedPaymentMethod === "PAYSTACK" && !deliveryZone.onlinePayEnabled) {
      return NextResponse.json(
        { error: "Online payment is currently unavailable for this delivery address." },
        { status: 400 }
      );
    }

    const deliveryZone = localityCheck.deliveryZones[0].deliveryZone;
    const deliveryFee = deliveryZone.baseDeliveryFee.toNumber();
    // 4. Fetch all variants, products, and sellers in one query
    const productIds = items.map((i) => i.productId);
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

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 5. Validate stock and calculate server-authoritative total
    const orderItemsData: Array<{
      variantId: string;
      sellerId: string;
      title: string;
      quantity: number;
      price: number;
    }> = [];

    let serverCalculatedTotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found or inactive: ${item.productId}` },
          { status: 400 }
        );
      }

      const variant = product.variants[0];
      if (!variant) {
        return NextResponse.json(
          { error: `No active variant for product: ${product.title}` },
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

      const lineTotal = variant.price.toNumber() * item.quantity;
      serverCalculatedTotal += lineTotal;
       
          // After the loop that calculates serverCalculatedTotal, add:
      serverCalculatedTotal += deliveryFee; // Include delivery fee in total
      orderItemsData.push({
        variantId: variant.id,
        sellerId: product.sellerId,
        title: product.title,
        quantity: item.quantity,
        price: variant.price.toNumber(),
      });
    }

    // ==========================================
    // 5b. Apply voucher discount (BEFORE TRANSACTION)
    // ==========================================
    let discountAmount = 0;
    let appliedVoucherId: string | null = null;

    if (body.voucherCode) {
      const voucher = await db.voucher.findUnique({
        where: { code: body.voucherCode.toUpperCase() },
      });

      if (voucher && voucher.isActive) {
        const now = new Date();
        const isValidDate = (!voucher.startsAt || now >= voucher.startsAt) && (!voucher.expiresAt || now <= voucher.expiresAt);
        const hasUsageLeft = !voucher.usageLimit || voucher.usedCount < voucher.usageLimit;
           // The minOrderAmount check should be on the product subtotal, not the total with delivery
    const productSubtotal = serverCalculatedTotal - deliveryFee;
    const meetsMinOrder = !voucher.minOrderAmount || productSubtotal >= voucher.minOrderAmount.toNumber();
        if (isValidDate && hasUsageLeft && meetsMinOrder) {
          if (voucher.type === "PERCENTAGE") {
            discountAmount = (serverCalculatedTotal * voucher.value.toNumber()) / 100;
            if (voucher.maxDiscount && discountAmount > voucher.maxDiscount.toNumber()) {
              discountAmount = voucher.maxDiscount.toNumber();
            }
          } else if (voucher.type === "FIXED") {
            discountAmount = Math.min(voucher.value.toNumber(), serverCalculatedTotal);
          }

          appliedVoucherId = voucher.id;
        }    // After the voucher logic, check zone minimum order
    if (deliveryZone.minOrderValue && productSubtotal < deliveryZone.minOrderValue.toNumber()) {
      return NextResponse.json(
        { error: `Orders to this area require a minimum product value of GH₵${deliveryZone.minOrderValue.toFixed(2)}.` },
        { status: 400 }
      );
    }
      }
    }

    // Calculate final total AFTER discount logic, BEFORE transaction
    const finalTotal = Math.max(0, serverCalculatedTotal - discountAmount);

    // 6. Generate unique payment reference
    const reference = `IBUY-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

    // 7. ATOMIC TRANSACTION: Create Order + Items + Payment + Decrement Stock + Update Voucher
    const order = await db.$transaction(
      async (tx) => {
        // 7a. Create the Order
        const newOrder = await tx.order.create({
          data: {
            userId: session.user.id,
            shippingAddressId,
            totalAmount: finalTotal, // ✅ Now safely in scope!
            deliveryFee: deliveryFee, // 👈 NEW: Store delivery fee separately
            status: "PENDING",
            paymentReference: reference,
          },
        });

        // 7b. Create OrderItems
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

        // 7c. Create the Payment record (PENDING)
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            provider: "PAYSTACK",
            amount: finalTotal, // ✅ Use finalTotal here too
            currency: "GHS",
            status: "PENDING",
            metadata: { reference, email, discountApplied: discountAmount > 0 },
          },
        });

        // 7d. Increment voucher usage if applied
        if (appliedVoucherId) {
          await tx.voucher.update({
            where: { id: appliedVoucherId },
            data: { usedCount: { increment: 1 } },
          });
        }

        // 7e. Atomically decrement stock for each variant
        for (const item of orderItemsData) {
          await tx.productVariant.update({
            where: {
              id: item.variantId,
              stockQuantity: { gte: item.quantity }, // Safety check within transaction
            },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });
        }

        return newOrder;
      },
      {
        // Isolation level: Serializable prevents race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // 8. Return server-calculated amount to client
    return NextResponse.json({
      success: true,
      orderId: order.id,
      reference,
      deliveryFee: deliveryFee,
      amount: Math.round(finalTotal * 100), // Paystack expects pesewas
      serverCalculatedTotal,
      discountAmount,
      finalTotal,
    });
  } catch (error: any) {
    console.error("Payment initialization error:", error);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Duplicate payment reference. Please try again." },
          { status: 409 }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "A referenced record was not found. Stock may have changed." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: error.message || "Failed to initialize payment" },
      { status: 500 }
    );
  }
}