 // src/app/api/seller/products/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isValidPrice(value: unknown): value is number | string {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Find the seller profile
    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!seller) {
      return NextResponse.json({ products: [], pagination: { totalPages: 0, total: 0 } });
    }

    // 2. Parse Query Params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    
    const skip = (page - 1) * limit;

    // 3. Build Where Clause
    // We look for products where the seller has an OFFER.
    const where: any = {
      variants: {
        some: {
          sellerOffers: {
            some: {
              sellerId: seller.id,
            }
          }
        }
      },
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    // 4. Fetch Products
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
          variants: {
            include: {
              sellerOffers: {
                where: { sellerId: seller.id },
                take: 1,
              }
            }
          }
        },
      }),
      db.product.count({ where })
    ]);

    // 5. Format Data for Frontend
    const formattedProducts = products.map(p => {
      const variant = p.variants[0];
      const offer = variant?.sellerOffers[0];
      
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        imageUrl: p.images[0]?.url || null,
        categoryName: p.category?.name || "Uncategorized",
        reviewCount: 0,
        createdAt: p.createdAt.toISOString(),
        price: offer ? parseFloat(offer.price.toString()) : 0,
        stock: offer?.stockQuantity || 0,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        totalPages: Math.ceil(total / limit),
        total,
      }
    });

  } catch (error) {
    console.error("GET Seller Products Error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("id");

    if (!productId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // ✅ FIX: Verify ownership via SellerOffer instead of product.seller
    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });

    // Check if this seller actually has an offer for this product
    const offer = await db.sellerOffer.findFirst({
      where: {
        sellerId: seller.id,
        variant: { productId: productId }
      }
    });

    if (!offer) {
      return NextResponse.json({ error: "Forbidden or Product not found" }, { status: 403 });
    }

    // Delete the product (Cascade will handle variants/offers if set up in Prisma)
    await db.product.delete({ where: { id: productId } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 403 });

    const body = await req.json();
    const { productId, price, stockQuantity } = body;

    // Update the offer price and stock
    await db.sellerOffer.updateMany({
      where: {
        sellerId: seller.id,
        variant: { productId: productId }
      },
      data: {
        price: price ? String(price) : undefined,
        stockQuantity: stockQuantity !== undefined ? stockQuantity : undefined,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    // 1. Authenticate the user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // 2. Find the seller profile
    const seller = await db.sellerProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!seller) {
      return NextResponse.json(
        {
          error:
            "You need a seller profile before creating products.",
        },
        { status: 403 }
      );
    }

    // 3. Parse the request body
    const body = await req.json();

    const {
      title,
      description,
      categoryId,
      price,
      compareAtPrice,
      costPrice,
      sku,
      stock,
      status,
      imageUrls,
      attributes,
    } = body;

    // 4. Validate required fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof categoryId !== "string" ||
      !categoryId.trim() ||
      typeof sku !== "string" ||
      !sku.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Title, description, category, and SKU are required.",
        },
        { status: 400 }
      );
    }

    if (!isValidPrice(price) || Number(price) <= 0) {
      return NextResponse.json(
        { error: "Enter a valid price greater than zero." },
        { status: 400 }
      );
    }

    if (
      compareAtPrice !== undefined &&
      compareAtPrice !== null &&
      compareAtPrice !== "" &&
      !isValidPrice(compareAtPrice)
    ) {
      return NextResponse.json(
        { error: "Enter a valid comparison price." },
        { status: 400 }
      );
    }

    if (
      costPrice !== undefined &&
      costPrice !== null &&
      costPrice !== "" &&
      !isValidPrice(costPrice)
    ) {
      return NextResponse.json(
        { error: "Enter a valid cost price." },
        { status: 400 }
      );
    }

    const parsedStock = Number(stock);

    if (
      stock === undefined ||
      stock === null ||
      stock === "" ||
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      return NextResponse.json(
        { error: "Stock must be a non-negative integer." },
        { status: 400 }
      );
    }

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one product image." },
        { status: 400 }
      );
    }

    const validImageUrls = imageUrls.filter(
      (url: unknown): url is string =>
        typeof url === "string" &&
        url.trim().length > 0 &&
        /^https?:\/\//i.test(url)
    );

    if (validImageUrls.length === 0) {
      return NextResponse.json(
        { error: "No valid uploaded image URLs were provided." },
        { status: 400 }
      );
    }

    // 5. Validate product status
    const productStatus =
      status === "ACTIVE" ? "ACTIVE" : "DRAFT";

    // 6. Verify the category exists
    const category = await db.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "The selected category does not exist." },
        { status: 400 }
      );
    }

    // 7. Check the SKU before creating anything
    const normalizedSku = sku.trim();

    const existingVariant = await db.productVariant.findUnique({
      where: {
        sku: normalizedSku,
      },
      select: {
        id: true,
      },
    });

    if (existingVariant) {
      return NextResponse.json(
        {
          error:
            "This SKU is already in use. Please enter a unique SKU.",
        },
        { status: 409 }
      );
    }

    // 8. Generate a unique slug
    const baseSlug = createSlug(title);

    if (!baseSlug) {
      return NextResponse.json(
        { error: "Please enter a valid product title." },
        { status: 400 }
      );
    }

    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

    // 9. Prepare optional JSON attributes
    const productAttributes =
      attributes &&
      typeof attributes === "object" &&
      !Array.isArray(attributes)
        ? attributes
        : undefined;

    // 10. Create everything in one transaction
    const createdProduct = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          slug,
          categoryId,
          sellerId: seller.id,
          status: productStatus,
          ...(productAttributes
            ? {
                attributes:
                  productAttributes as Prisma.InputJsonValue,
              }
            : {}),
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: normalizedSku,
          price: new Prisma.Decimal(String(price)),
          compareAtPrice:
            compareAtPrice !== undefined &&
            compareAtPrice !== null &&
            compareAtPrice !== ""
              ? new Prisma.Decimal(String(compareAtPrice))
              : null,
          costPrice:
            costPrice !== undefined &&
            costPrice !== null &&
            costPrice !== ""
              ? new Prisma.Decimal(String(costPrice))
              : null,
          stockQuantity: parsedStock,
          isActive: productStatus === "ACTIVE",
          ...(productAttributes
            ? {
                attributes:
                  productAttributes as Prisma.InputJsonValue,
              }
            : {}),
        },
      });

      await tx.productImage.createMany({
        data: validImageUrls.map((url, index) => ({
          productId: product.id,
          url,
          sortOrder: index,
          isPrimary: index === 0,
        })),
      });

      const offer = await tx.sellerOffer.create({
        data: {
          sellerId: seller.id,
          variantId: variant.id,
          price: new Prisma.Decimal(String(price)),
          stockQuantity: parsedStock,
          status: productStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        },
      });

      return {
        product,
        variant,
        offer,
      };
    });

    // 11. Return the created product
    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully.",
        product: {
          id: createdProduct.product.id,
          title: createdProduct.product.title,
          slug: createdProduct.product.slug,
          status: createdProduct.product.status,
          variantId: createdProduct.variant.id,
          offerId: createdProduct.offer.id,
          sku: createdProduct.variant.sku,
          price: createdProduct.offer.price.toString(),
          stock: createdProduct.offer.stockQuantity,
          imageUrl: validImageUrls[0],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Seller Products Error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "A product with one of these unique values already exists. Check the SKU and try again.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error:
            "A referenced record is invalid. Check the selected category and seller profile.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create product.",
        details:
          process.env.NODE_ENV === "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}