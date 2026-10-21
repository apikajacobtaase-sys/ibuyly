 // src/app/api/cart/route.ts

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { z } from "zod";

const COOKIE_NAME = "ibuy_cart_session";

const AddItemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().min(1),
  offerId: z.string().min(1),
  quantity: z.number().int().positive().max(100).default(1),
});

async function getCartIdentity() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    let cart = await db.cart.findUnique({
      where: { userId: session.user.id },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId: session.user.id },
      });
    }

    return {
      authenticated: true,
      cartId: cart.id,
      sessionId: null as string | null,
      userId: session.user.id,
    };
  }

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    sessionId = randomUUID();
  }

  let cart = await db.cart.findUnique({
    where: { sessionId },
  });

  if (!cart) {
    cart = await db.cart.create({
      data: { sessionId },
    });
  }

  return {
    authenticated: false,
    cartId: cart.id,
    sessionId,
    userId: null,
  };
}

function attachGuestCookie(
  response: NextResponse,
  identity: Awaited<ReturnType<typeof getCartIdentity>>,
) {
  if (!identity.authenticated && identity.sessionId) {
    response.cookies.set(COOKIE_NAME, identity.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

async function getFormattedItems(cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
      offer: {
        include: {
          seller: {
            select: { id: true, businessName: true },
          },
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    productId: item.variant.productId,
    variantId: item.variantId,
    offerId: item.offerId,
    title: item.variant.product.title,
    slug: item.variant.product.slug,
    imageUrl: item.variant.product.images[0]?.url ?? null,
    price: Number(item.offer?.price ?? item.variant.price),
    stockQuantity: item.offer
      ? item.offer.stockQuantity
      : item.variant.stockQuantity,
    sellerId: item.offer?.sellerId ?? "unknown",
    sellerName: item.offer?.seller?.businessName ?? "Seller",
    quantity: item.quantity,
    isSelected: item.isSelected,
  }));
}

// GET /api/cart
export async function GET() {
  try {
    const identity = await getCartIdentity();
    const items = await getFormattedItems(identity.cartId);

    return attachGuestCookie(
      NextResponse.json({
        authenticated: identity.authenticated,
        items,
      }),
      identity,
    );
  } catch (error) {
    console.error("GET Cart Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
}

// POST /api/cart
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AddItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid cart item", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { variantId, offerId, quantity } = parsed.data;
    const identity = await getCartIdentity();

    const offer = await db.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        variant: {
          include: { product: true },
        },
      },
    });

    if (
      !offer ||
      offer.variantId !== variantId ||
      offer.status !== "ACTIVE" ||
      !offer.variant.isActive ||
      offer.variant.product.status !== "ACTIVE"
    ) {
      return attachGuestCookie(
        NextResponse.json(
          { error: "This seller's offer is no longer available." },
          { status: 409 },
        ),
        identity,
      );
    }

    const stock = offer.stockQuantity;

    if (stock <= 0) {
      return attachGuestCookie(
        NextResponse.json({ error: "This item is out of stock." }, { status: 409 }),
        identity,
      );
    }

    const existingItem = await db.cartItem.findFirst({
      where: {
        cartId: identity.cartId,
        variantId,
        offerId,
      },
    });

    const newQuantity = Math.min(
      (existingItem?.quantity ?? 0) + quantity,
      stock,
    );

    const item = existingItem
      ? await db.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        })
      : await db.cartItem.create({
          data: {
            cartId: identity.cartId,
            variantId,
            offerId,
            quantity: Math.min(quantity, stock),
            isSelected: true,
          },
        });

    return attachGuestCookie(
      NextResponse.json({
        success: true,
        item: {
          id: item.id,
          quantity: item.quantity,
        },
      }),
      identity,
    );
  } catch (error) {
    console.error("POST Cart Error:", error);

    return NextResponse.json(
      { error: "Failed to add item to cart" },
      { status: 500 },
    );
  }
}

// PATCH /api/cart
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const schema = z.object({
      cartItemId: z.string().min(1),
      quantity: z.number().int().positive().max(100).optional(),
      isSelected: z.boolean().optional(),
    }).refine(
      (data) =>
        data.quantity !== undefined || data.isSelected !== undefined,
      { message: "Provide a quantity or selection update." },
    );

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid cart update" },
        { status: 400 },
      );
    }

    const identity = await getCartIdentity();
    const { cartItemId, quantity, isSelected } = parsed.data;

    const item = await db.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: identity.cartId,
      },
      include: { offer: true },
    });

    if (!item) {
      return attachGuestCookie(
        NextResponse.json({ error: "Cart item not found" }, { status: 404 }),
        identity,
      );
    }

    let finalQuantity = quantity;

    if (quantity !== undefined) {
      const stock = item.offer?.stockQuantity ?? 0;

      if (stock <= 0) {
        return attachGuestCookie(
          NextResponse.json({ error: "This item is out of stock." }, { status: 409 }),
          identity,
        );
      }

      finalQuantity = Math.min(quantity, stock);
    }

    await db.cartItem.update({
      where: { id: item.id },
      data: {
        ...(finalQuantity !== undefined && { quantity: finalQuantity }),
        ...(isSelected !== undefined && { isSelected }),
      },
    });

    return attachGuestCookie(
      NextResponse.json({ success: true }),
      identity,
    );
  } catch (error) {
    console.error("PATCH Cart Error:", error);

    return NextResponse.json(
      { error: "Failed to update cart item" },
      { status: 500 },
    );
  }
}

// DELETE /api/cart?itemId=...
export async function DELETE(req: NextRequest) {
  try {
    const identity = await getCartIdentity();

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const itemId =
      searchParams.get("itemId") ??
      (typeof body.cartItemId === "string" ? body.cartItemId : null);

    if (!itemId) {
      return attachGuestCookie(
        NextResponse.json({ error: "Cart item ID is required" }, { status: 400 }),
        identity,
      );
    }

    await db.cartItem.deleteMany({
      where: {
        id: itemId,
        cartId: identity.cartId,
      },
    });

    return attachGuestCookie(
      NextResponse.json({ success: true }),
      identity,
    );
  } catch (error) {
    console.error("DELETE Cart Error:", error);

    return NextResponse.json(
      { error: "Failed to remove cart item" },
      { status: 500 },
    );
  }
}