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

    console.log(`🛒 Checkout initiated by ${session.user.id} for items:`, validated.cartItemIds);

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

    console.log(`🔍 Found ${cartItems.length} items in DB.`);

    // ✅ FIX: Explicitly type validItems to match cartItems type
    const validItems: typeof cartItems = [];
    const invalidReasons: string[] = [];

    for (const item of cartItems) {
      if (!item.offerId) {
        invalidReasons.push(`Item ${item.id}: Missing offerId in DB`);
      } else if (!item.offer) {
        invalidReasons.push(`Item ${item.id}: Offer ${item.offerId} not found in DB`);
      } else if (item.offer.status !== "ACTIVE") {
        invalidReasons.push(`Item ${item.id}: Offer is ${item.offer.status}`);
      } else {
        validItems.push(item);
      }
    }

    if (invalidReasons.length > 0) {
      console.warn("⚠️ Invalid Items Detected:", invalidReasons);
    }

    if (validItems.length === 0) {
      return NextResponse.json({ 
        error: "No valid offers found in cart.", 
        debug: invalidReasons 
      }, { status: 400 });
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
      return NextResponse.json({ error: "Delivery is no longer available to this location." }, { status: 400 });
    }

    const zone = zoneLocality.deliveryZone;
    const deliveryFee = parseFloat(zone.baseDeliveryFee.toString());

    // 3. Calculate Server-Side Subtotal
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
          throw new Error(`Insufficient stock for "${offer.variant.product.title}". Only ${offer.stockQuantity} left.`);
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

    // 5. Paystack
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: session.user.email,
        amount: Math.round(finalTotal * 100),
        reference: `ORDER-${order.id}-${Date.now()}`,
        callback_url: `https://ibuy-apikajacobtaase-sys.vercel.app/payment/success`,
        metadata: { order_id: order.id },
      }),
    });

    
const paystackData = await paystackResponse.json();
if (!paystackData.status) {
  throw new Error(paystackData.message || "Paystack initialization failed");
}

// ✅ FIX: Ensure we save the reference from Paystack's response
const paystackRef = paystackData.data.reference;

await db.order.update({
  where: { id: order.id },
  data: { paymentReference: paystackRef }, // Save it here
});

return NextResponse.json({
  success: true,
  orderId: order.id,
  authorizationUrl: paystackData.data.authorization_url,
  reference: paystackRef, // Send it back to frontend too
});

  } catch (error: any) {
    console.error("🚨 Checkout error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Invalid form data" }, { status: 400 });
    }
    if (error.message?.includes("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to process checkout", details: error.message }, { status: 500 });
  }
}