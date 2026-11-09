import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { Prisma } from "@prisma/client";

function isValidPrice(value: unknown): value is number | string {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isValidStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

async function readBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// GET: List this seller's catalogue offers.
export async function GET(req: Request) {
  try {
    const auth = await authorizeSeller("manage_products");

    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const sort = searchParams.get("sort") || "newest";

    const where: Prisma.SellerOfferWhereInput = {
      sellerId: auth.sellerId,
      ...(status &&
      ["ACTIVE", "PAUSED", "OUT_OF_STOCK"].includes(status)
        ? { status: status as "ACTIVE" | "PAUSED" | "OUT_OF_STOCK" }
        : {}),
      ...(search
        ? {
            variant: {
              product: {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.SellerOfferOrderByWithRelationInput =
      sort === "oldest"
        ? { createdAt: "asc" }
        : sort === "price-low"
          ? { price: "asc" }
          : sort === "price-high"
            ? { price: "desc" }
            : { createdAt: "desc" };

    const [offers, total] = await Promise.all([
      db.sellerOffer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          variant: {
            include: {
              product: {
                include: {
                  category: { select: { name: true } },
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
      db.sellerOffer.count({ where }),
    ]);

    const products = offers.map((offer) => {
      const product = offer.variant.product;

      return {
        id: offer.id,
        offerId: offer.id,
        productId: product.id,
        variantId: offer.variantId,
        title: product.title,
        slug: product.slug,
        status: offer.status,
        price: Number(offer.price),
        stock: offer.stockQuantity,
        imageUrl: product.images[0]?.url || null,
        categoryName: product.category?.name || "Uncategorized",
        reviewCount: 0,
        createdAt: offer.createdAt.toISOString(),
        variantSku: offer.variant.sku,
        variantAttributes: offer.variant.attributes,
        condition: offer.condition,
        sellerSku: offer.sellerSku,
      };
    });

    return NextResponse.json({
      products,
      pagination: {
        totalPages: Math.ceil(total / limit),
        total,
        page,
      },
    });
  } catch (error) {
    console.error("GET Seller Offers Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch your inventory." },
      { status: 500 }
    );
  }
}

// POST: Create an offer for an existing catalogue variant.
export async function POST(req: Request) {
  try {
    const body = await readBody(req);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const {
      variantId,
      price,
      stockQuantity,
      sellerSku,
      condition,
      status,
    } = body as Record<string, unknown>;

    if (typeof variantId !== "string" || !variantId.trim()) {
      return NextResponse.json(
        { error: "Select a valid catalogue variant." },
        { status: 400 }
      );
    }

    if (!isValidPrice(price)) {
      return NextResponse.json(
        { error: "Enter a valid selling price greater than zero." },
        { status: 400 }
      );
    }

    if (!isValidStock(stockQuantity)) {
      return NextResponse.json(
        { error: "Stock must be a non-negative integer." },
        { status: 400 }
      );
    }

    if (
      sellerSku !== undefined &&
      sellerSku !== null &&
      (typeof sellerSku !== "string" || sellerSku.trim().length > 100)
    ) {
      return NextResponse.json(
        { error: "Enter a valid seller SKU." },
        { status: 400 }
      );
    }

    if (
      condition !== undefined &&
      (typeof condition !== "string" || condition.trim().length > 50)
    ) {
      return NextResponse.json(
        { error: "Enter a valid product condition." },
        { status: 400 }
      );
    }

    if (status !== undefined && status !== "ACTIVE" && status !== "PAUSED") {
      return NextResponse.json(
        { error: "Invalid offer status." },
        { status: 400 }
      );
    }

    const auth = await authorizeSeller("manage_products");

    if (!auth.authorized) return auth.response;

    const inventoryAuth = await authorizeSeller(
      "manage_inventory",
      auth.sellerId
    );

    if (!inventoryAuth.authorized) return inventoryAuth.response;

    const variant = await db.productVariant.findFirst({
      where: {
        id: variantId,
        isActive: true,
        product: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "This catalogue variant is unavailable." },
        { status: 404 }
      );
    }

    const existingOffer = await db.sellerOffer.findUnique({
      where: {
        sellerId_variantId: {
          sellerId: auth.sellerId,
          variantId,
        },
      },
      select: { id: true },
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: "You have already listed this variant." },
        { status: 409 }
      );
    }

    const offerStatus =
      stockQuantity === 0
        ? "OUT_OF_STOCK"
        : status === "PAUSED"
          ? "PAUSED"
          : "ACTIVE";

    const offer = await db.sellerOffer.create({
      data: {
        sellerId: auth.sellerId,
        variantId,
        price: new Prisma.Decimal(String(price)),
        stockQuantity,
        sellerSku:
          typeof sellerSku === "string" && sellerSku.trim()
            ? sellerSku.trim()
            : null,
        condition:
          typeof condition === "string" && condition.trim()
            ? condition.trim()
            : "NEW",
        status: offerStatus,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your offer has been added successfully.",
        offer: {
          id: offer.id,
          offerId: offer.id,
          productId: variant.product.id,
          variantId: offer.variantId,
          title: variant.product.title,
          price: Number(offer.price),
          stock: offer.stockQuantity,
          status: offer.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Seller Offer Error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This variant or seller SKU is already in use." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add this catalogue item to your inventory." },
      { status: 500 }
    );
  }
}

// PUT: Update price and/or stock on one seller offer.
export async function PUT(req: Request) {
  try {
    const body = await readBody(req);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { offerId, price, stockQuantity } =
      body as Record<string, unknown>;

    if (typeof offerId !== "string" || !offerId.trim()) {
      return NextResponse.json(
        { error: "Offer ID is required." },
        { status: 400 }
      );
    }

    if (price !== undefined && !isValidPrice(price)) {
      return NextResponse.json(
        { error: "Enter a valid selling price greater than zero." },
        { status: 400 }
      );
    }

    if (
      stockQuantity !== undefined &&
      !isValidStock(stockQuantity)
    ) {
      return NextResponse.json(
        { error: "Stock must be a non-negative integer." },
        { status: 400 }
      );
    }

    if (price === undefined && stockQuantity === undefined) {
      return NextResponse.json(
        { error: "No changes were provided." },
        { status: 400 }
      );
    }

    // Price and stock are independently permission-controlled.
    const permission = price !== undefined
      ? "manage_products"
      : "manage_inventory";

    const auth = await authorizeSeller(permission);

    if (!auth.authorized) return auth.response;

    if (price !== undefined && stockQuantity !== undefined) {
      const inventoryAuth = await authorizeSeller(
        "manage_inventory",
        auth.sellerId
      );

      if (!inventoryAuth.authorized) return inventoryAuth.response;
    }

    const existingOffer = await db.sellerOffer.findFirst({
      where: {
        id: offerId,
        sellerId: auth.sellerId,
      },
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: "Offer not found in your inventory." },
        { status: 404 }
      );
    }

    let nextStatus = existingOffer.status;

    if (stockQuantity !== undefined) {
      if (stockQuantity === 0) {
        nextStatus = "OUT_OF_STOCK";
      } else if (existingOffer.status === "OUT_OF_STOCK") {
        nextStatus = "ACTIVE";
      }
    }

    const offer = await db.sellerOffer.update({
      where: { id: existingOffer.id },
      data: {
        ...(price !== undefined
          ? { price: new Prisma.Decimal(String(price)) }
          : {}),
        ...(stockQuantity !== undefined ? { stockQuantity } : {}),
        ...(stockQuantity !== undefined ? { status: nextStatus } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Offer updated successfully.",
      offer: {
        id: offer.id,
        price: Number(offer.price),
        stock: offer.stockQuantity,
        status: offer.status,
      },
    });
  } catch (error) {
    console.error("PUT Seller Offer Error:", error);

    return NextResponse.json(
      { error: "Failed to update your offer." },
      { status: 500 }
    );
  }
}

// PATCH: Activate, pause or mark an offer out of stock.
export async function PATCH(req: Request) {
  try {
    const body = await readBody(req);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { offerId, status } = body as Record<string, unknown>;

    if (
      typeof offerId !== "string" ||
      !["ACTIVE", "PAUSED", "OUT_OF_STOCK"].includes(String(status))
    ) {
      return NextResponse.json(
        { error: "A valid offer ID and status are required." },
        { status: 400 }
      );
    }

    const auth = await authorizeSeller("manage_products");

    if (!auth.authorized) return auth.response;

    if (status === "OUT_OF_STOCK") {
      const inventoryAuth = await authorizeSeller(
        "manage_inventory",
        auth.sellerId
      );

      if (!inventoryAuth.authorized) return inventoryAuth.response;
    }

    const existingOffer = await db.sellerOffer.findFirst({
      where: {
        id: offerId,
        sellerId: auth.sellerId,
      },
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: "Offer not found in your inventory." },
        { status: 404 }
      );
    }

    if (status === "ACTIVE" && existingOffer.stockQuantity === 0) {
      return NextResponse.json(
        { error: "Add stock before activating this offer." },
        { status: 400 }
      );
    }

    const offer = await db.sellerOffer.update({
      where: { id: existingOffer.id },
      data: { status: status as "ACTIVE" | "PAUSED" | "OUT_OF_STOCK" },
    });

    return NextResponse.json({
      success: true,
      message: "Offer status updated successfully.",
      offer: {
        id: offer.id,
        status: offer.status,
      },
    });
  } catch (error) {
    console.error("PATCH Seller Offer Error:", error);

    return NextResponse.json(
      { error: "Failed to update offer status." },
      { status: 500 }
    );
  }
}

// DELETE: Remove a seller's offer without deleting catalogue data.
export async function DELETE(req: Request) {
  try {
    const auth = await authorizeSeller("manage_products");

    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const offerId = searchParams.get("id");

    if (!offerId) {
      return NextResponse.json(
        { error: "Offer ID is required." },
        { status: 400 }
      );
    }

    const result = await db.sellerOffer.deleteMany({
      where: {
        id: offerId,
        sellerId: auth.sellerId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Offer not found in your inventory." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Offer removed from your inventory.",
    });
  } catch (error) {
    console.error("DELETE Seller Offer Error:", error);

    return NextResponse.json(
      { error: "Failed to remove your offer." },
      { status: 500 }
    );
  }
}