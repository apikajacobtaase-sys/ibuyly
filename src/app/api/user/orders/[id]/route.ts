 // src/app/api/user/orders/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

// src/app/api/user/orders/[id]/route.ts

const order = await db.order.findFirst({
  where: {
    id: params.id,
    userId: session.user.id,
  },
  include: {
    items: {
      include: {
        // ✅ FIX: Go through 'offer' to get to 'seller'
        offer: {
          include: {
            seller: {
              select: {
                businessName: true,
                id: true,
              },
            },
          },
        },
        variant: {
          select: {
            sku: true,
            product: {
              select: {
                slug: true,
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    },
  },
});

if (!order) {
  return NextResponse.json({ error: "Order not found" }, { status: 404 });
}

// ✅ FIX: Map the seller name from offer.seller.businessName
const formattedItems = order.items.map((item) => ({
  id: item.id,
  title: item.title,
  slug: item.variant?.product?.slug || null,
  productId: item.variant?.productId || null,
  variantId: item.variantId,
  quantity: item.quantity,
  price: item.price.toNumber(),
  subtotal: item.price.toNumber() * item.quantity,
  status: item.status,
  imageUrl: item.variant?.product?.images?.[0]?.url || null,
  sku: item.variant?.sku || "N/A",
  sellerId: item.sellerId,
  // ✅ FIX: Use optional chaining through offer
  sellerName: item.offer?.seller?.businessName || "Seller information unavailable",
  offerId: item.offerId,
}));

return NextResponse.json({
  order: {
    ...order,
    items: formattedItems,
    totalAmount: order.totalAmount.toNumber(),
    deliveryFee: order.deliveryFee.toNumber(),
    subtotal: formattedItems.reduce((sum, item) => sum + item.subtotal, 0),
  },
});
 
 
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}