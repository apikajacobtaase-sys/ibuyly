 // src/app/api/checkout/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const checkoutSchema = z.object({
  cartItemIds: z.array(z.string()).min(1, "At least one item is required"),
  localityId: z.string().min(1, "Locality ID is required"),
  discountId: z.string().optional(),
  discountAmount: z.number().optional(),
  address: z.object({
    recipientName: z.string().min(1, "Recipient name is required"),
    phone: z.string().min(1, "Phone number is required"),
    country: z.string().optional().default("Ghana"),
    landmark: z.string().optional(),
    street: z.string().min(1, "Street details are required"),
    instructions: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = checkoutSchema.parse(body);

    // 1. Fetch cart items
    const cartItems = await db.cartItem.findMany({
      where: {
        id: { in: validated.cartItemIds },
        cart: { userId: session.user.id },
      },
      include: {
        offer: {
          include: {
            variant: { include: { product: { select: { title: true } } } },
            seller: { select: { id: true } },
          },
        },
      },
    });

    const validItems: typeof cartItems = [];
    for (const item of cartItems) {
      if (item.offer && item.offer.status === "ACTIVE") {
        validItems.push(item);
      }
    }

    if (validItems.length === 0) {
      return NextResponse.json({ error: "No valid items in cart." }, { status: 400 });
    }

    // 2. Validate Delivery Zone
    const zoneLocality = await db.deliveryZoneLocality.findFirst({
      where: {
        localityId: validated.localityId,
        deliveryZone: { status: "ACTIVE" },
      },
      include: {
        deliveryZone: true,
        locality: { include: { district: { include: { region: true } } } },
      },
    });

    if (!zoneLocality) {
      return NextResponse.json({ error: "Delivery unavailable to this location." }, { status: 400 });
    }

    const zone = zoneLocality.deliveryZone;
    const deliveryFee = parseFloat(zone.baseDeliveryFee.toString());

    // 3. Calculate Total
    let serverSubtotal = 0;
    for (const item of validItems) {
      serverSubtotal += parseFloat(item.offer!.price.toString()) * item.quantity;
    }

    const discountAmount = validated.discountAmount || 0;
    const finalTotal = Math.max(0, serverSubtotal + deliveryFee - discountAmount);

    // 4. Atomic Transaction
    const order = await db.$transaction(async (tx) => {
      // A. Validate Stock
      for (const item of validItems) {
        const offer = item.offer!; 
        if (offer.stockQuantity < item.quantity) {
          throw new Error(`Insufficient stock for "${offer.variant.product.title}".`);
        }
      }

      // B. Create Order
      const newOrder = await tx.order.create({
        data: {
          userId: session.user.id,
          totalAmount: finalTotal,
          status: "PENDING",
          discountCodeId: validated.discountId || null,
          discountAmount: discountAmount,
          deliveryRecipient: validated.address.recipientName,
          deliveryPhone: validated.address.phone,
          deliveryFee: deliveryFee,
          deliveryRegion: zoneLocality.locality.district.region.name,
          deliveryDistrict: zoneLocality.locality.district.name,
          deliveryLocality: zoneLocality.locality.name,
          deliveryLandmark: validated.address.landmark || null,
          deliveryStreet: validated.address.street,
          payment: {
            create: {
              provider: "PAYSTACK",
              status: "PENDING",
              amount: finalTotal,
              currency: "GHS",
            },
          },
          items: {
            create: validItems.map((item) => {
              const offer = item.offer!;
              return {
                variant: { connect: { id: offer.variantId } },
                title: offer.variant.product.title,
                price: parseFloat(offer.price.toString()),
                quantity: item.quantity,
                sellerId: offer.sellerId,
                offer: { connect: { id: offer.id } },
                status: "PENDING",
              };
            }),
          },
        },
      });

      // C. Deduct Stock
      for (const item of validItems) {
        await tx.sellerOffer.update({
          where: { id: item.offer!.id },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // D. Clear Cart
      await tx.cartItem.deleteMany({
        where: { id: { in: validated.cartItemIds } },
      });
      
      return newOrder;
    });

    // 5. Initialize Paystack
    // ✅ Use a simple, unique reference based on Order ID
    const localReference = `ORD-${order.id}`;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  email: session.user.email,
  amount: Math.round(finalTotal * 100),
  reference: localReference,
  callback_url: `${process.env.NEXTAUTH_URL}/payment/success`,
  channels: ["card", "mobile_money", "apple_pay"], // ✅ Added apple_pay
  metadata: { 
    custom_fields: [
      { display_name: "Order ID", variable_name: "order_id", value: order.id }
    ] 
  },
}),
    });

    const paystackData = await paystackResponse.json();
    
    if (!paystackData.status) {
      throw new Error(paystackData.message || "Paystack initialization failed");
    }

    // ✅ IMPORTANT: Save the reference returned by Paystack, not just our local one
    // Paystack sometimes modifies or validates the reference. We must use theirs for verification.
    const paystackRef = paystackData.data.reference;

    await db.order.update({
      where: { id: order.id },
      data: { paymentReference: paystackRef },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackRef,
    });

  } catch (error: any) {
    console.error("🚨 Checkout error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed", details: error.message }, { status: 500 });
  }
}