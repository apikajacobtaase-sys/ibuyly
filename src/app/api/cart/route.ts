 // src/app/api/cart/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ items: [] });
    }

    // 1. Find or Create the User's Cart
    let cart = await db.cart.findFirst({
      where: { userId: session.user.id },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId: session.user.id },
      });
    }

    // 2. Fetch Items for this Cart
    const cartItems = await db.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
        offer: {
          include: {
            seller: { select: { businessName: true, id: true } },
          },
        },
      },
    });

    const formattedItems = cartItems.map((item) => ({
      id: item.id,
      productId: item.variant.productId,
      variantId: item.variantId,
      offerId: item.offerId, // Can be null in your schema
      title: item.variant.product.title,
      slug: item.variant.product.slug,
      imageUrl: item.variant.product.images[0]?.url || null,
      price: item.offer ? parseFloat(item.offer.price.toString()) : 0,
      stockQuantity: item.offer?.stockQuantity || 0,
      sellerId: item.offer?.sellerId || "unknown",
      sellerName: item.offer?.seller?.businessName || "Unknown Seller",
      quantity: item.quantity,
      isSelected: item.isSelected,
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error("GET Cart Error:", error);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, variantId, offerId, quantity = 1 } = body;

    if (!variantId) {
      return NextResponse.json({ error: "Variant ID is required" }, { status: 400 });
    }

    // 1. Find or Create the User's Cart
    let cart = await db.cart.findFirst({
      where: { userId: session.user.id },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId: session.user.id },
      });
    }

    // 2. Check if item already exists in cart (matching variant AND offer)
    const existingItem = await db.cartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId,
        offerId, // This will match null if offerId is null
      },
    });

    if (existingItem) {
      // Update quantity
      await db.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      // Create new item
      await db.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          offerId, // ✅ Now correctly handles optional offerId
          quantity,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Cart Error:", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (itemId) {
      // Ensure user owns the cart item before deleting
      await db.cartItem.deleteMany({
        where: { 
          id: itemId,
          cart: { userId: session.user.id } 
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Cart Error:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}