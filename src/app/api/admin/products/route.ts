// src/app/api/admin/products/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    // 1. Use our reusable admin guard (allows ADMIN and SUPER_ADMIN)
    const { user, error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClause: any = {};
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // 2. Fetch products with safe relations
    const products = await db.product.findMany({
      where: whereClause,
      include: {
        seller: { select: { businessName: true } },
        category: { select: { name: true } },
        variants: { take: 1, select: { price: true } },
        images: { take: 1, select: { url: true } },
      },
      orderBy: { id: "desc" }, // Safe fallback if createdAt is missing
      take: 100,
    });

    // 3. Map with SAFE navigation (?.) to prevent crashes on null relations
    const formattedProducts = products.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      sellerName: p.seller?.businessName || "Seller information unavailable",
      categoryName: p.category?.name || "Uncategorized",
      price: p.variants[0]?.price ? Number(p.variants[0].price) : 0,
      imageUrl: p.images[0]?.url || null,
      createdAt: p.createdAt || new Date().toISOString(),
    }));

    return NextResponse.json({ products: formattedProducts });
  } catch (error: any) {
    // 4. Log the EXACT error to the terminal so we can see what's wrong
    console.error("🚨 Admin fetch products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const { productId, status } = body;

    if (!productId || !["ACTIVE", "ARCHIVED", "DRAFT", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid product ID or status" }, { status: 400 });
    }

    const updated = await db.product.update({
      where: { id: productId },
      data: { status },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    console.error("🚨 Admin update product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

// Create a central catalogue product (not a seller-owned product).
const CreateProductSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(10000),
  slug: z.string().trim().min(2).max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().cuid(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  variants: z.array(
    z.object({
      sku: z.string().trim().min(2).max(100),
      price: z.number().positive().finite(),
      compareAtPrice: z.number().positive().finite().nullable().optional(),
      stockQuantity: z.number().int().min(0).default(0),
      lowStockThreshold: z.number().int().min(0).default(5),
      attributes: z.record(z.string(), z.string()).optional(),
    })
  ).min(1).max(50),
  images: z.array(
    z.object({
      url: z.string().url(),
      altText: z.string().max(300).nullable().optional(),
      isPrimary: z.boolean().default(false),
    })
  ).max(10).default([]),
});

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = CreateProductSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid product information",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      slug,
      categoryId,
      status,
      variants,
      images,
    } = validation.data;

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Selected category does not exist" },
        { status: 400 }
      );
    }

    if (!category.isActive && status === "ACTIVE") {
      return NextResponse.json(
        { error: "An active product requires an active category" },
        { status: 400 }
      );
    }

    const existingSlug = await db.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "A product with this slug already exists" },
        { status: 409 }
      );
    }

    const primaryImages = images.filter((image) => image.isPrimary);

    if (primaryImages.length > 1) {
      return NextResponse.json(
        { error: "Only one image can be selected as primary" },
        { status: 400 }
      );
    }

    const normalizedImages = images.map((image, index) => ({
      url: image.url,
      altText: image.altText || null,
      sortOrder: index,
      isPrimary: primaryImages.length === 1
        ? image.isPrimary
        : index === 0,
    }));

    const product = await db.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          sellerId: null,
          title,
          description,
          slug,
          categoryId,
          status,
          variants: {
            create: variants.map((variant) => ({
              sku: variant.sku,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice ?? null,
              stockQuantity: variant.stockQuantity,
              lowStockThreshold: variant.lowStockThreshold,
              attributes: variant.attributes,
            })),
          },
          images: {
            create: normalizedImages,
          },
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
          variants: true,
          images: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PRODUCT_CREATED",
          resourceType: "Product",
          resourceId: createdProduct.id,
          metadata: {
            title: createdProduct.title,
            slug: createdProduct.slug,
            status: createdProduct.status,
            variantCount: createdProduct.variants.length,
            imageCount: createdProduct.images.length,
            sellerId: null,
          },
        },
      });

      return createdProduct;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Catalogue product created successfully",
        product,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Admin create catalogue product error:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A product slug or variant SKU already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create catalogue product" },
      { status: 500 }
    );
  }
}
