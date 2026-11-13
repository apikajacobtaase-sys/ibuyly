// src/app/api/admin/products/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user?.role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            businessName: true,
            verificationStatus: true,
            user: { select: { email: true } },
          },
        },
        category: { select: { name: true } },
        variants: true,
        images: { orderBy: { sortOrder: "asc" } },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user?.role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { status, feedback } = await req.json();

    const validStatuses = ["ACTIVE", "DRAFT", "ARCHIVED", "OUT_OF_STOCK"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await db.product.update({
      where: { id },
      data: { status },
    });

    // Log the moderation action
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: `PRODUCT_${status}`,
        resourceType: "Product",
        resourceId: id,
        metadata: feedback ? { feedback } : {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product moderation error:", error);
    return NextResponse.json({ error: "Failed to moderate product" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user?.role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const { title, description, categoryId, images, variants } = body;

    if (
      typeof title !== "string" || title.trim().length < 2 ||
      typeof description !== "string" || !description.trim() ||
      typeof categoryId !== "string" ||
      !Array.isArray(images) ||
      !Array.isArray(variants) || variants.length === 0
    ) {
      return NextResponse.json({ error: "Invalid product information." }, { status: 400 });
    }

    if (images.some((image: any) => typeof image.url !== "string" || !image.url.startsWith("https://"))) {
      return NextResponse.json({ error: "Invalid product image URL." }, { status: 400 });
    }

    const category = await db.category.findUnique({ where: { id: categoryId } });

    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const existing = await db.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    for (const variant of variants) {
      if (
        typeof variant.sku !== "string" || !variant.sku.trim() ||
        !Number.isFinite(Number(variant.price)) || Number(variant.price) < 0 ||
        !Number.isInteger(Number(variant.stockQuantity)) || Number(variant.stockQuantity) < 0 ||
        !Number.isInteger(Number(variant.lowStockThreshold)) || Number(variant.lowStockThreshold) < 0 ||
        (variant.compareAtPrice != null && (!Number.isFinite(Number(variant.compareAtPrice)) || Number(variant.compareAtPrice) < 0))
      ) {
        return NextResponse.json({ error: "Invalid variant or inventory information." }, { status: 400 });
      }
    }

    const existingVariantIds = new Set(existing.variants.map(v => v.id));

    if (variants.some((v: any) => v.id && !existingVariantIds.has(v.id))) {
      return NextResponse.json({ error: "Invalid variant reference." }, { status: 400 });
    }

    const slug = title.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const duplicateSlug = await db.product.findFirst({
      where: { slug, NOT: { id } },
    });

    if (duplicateSlug) {
      return NextResponse.json({ error: "Another product already uses this product name." }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          slug,
        },
      });

      await tx.productImage.deleteMany({ where: { productId: id } });

      if (images.length) {
        await tx.productImage.createMany({
          data: images.map((image: any, index: number) => ({
            productId: id,
            url: image.url,
            altText: image.altText || title.trim(),
            sortOrder: index,
            isPrimary: Boolean(image.isPrimary),
          })),
        });
      }

      for (const variant of variants) {
        const data = {
          sku: variant.sku.trim(),
          price: Number(variant.price),
          compareAtPrice: variant.compareAtPrice == null || variant.compareAtPrice === ""
            ? null
            : Number(variant.compareAtPrice),
          stockQuantity: Number(variant.stockQuantity),
          lowStockThreshold: Number(variant.lowStockThreshold),
          attributes: variant.attributes ?? undefined,
          isActive: variant.isActive !== false,
        };

        if (variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data,
          });
        } else {
          await tx.productVariant.create({
            data: { ...data, productId: id },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PRODUCT_UPDATED",
          resourceType: "Product",
          resourceId: id,
          metadata: {
            title: title.trim(),
            categoryId,
            variantsUpdated: variants.length,
            imagesUpdated: images.length,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Catalogue product updated successfully.",
    });
  } catch (error: any) {
    console.error("Catalogue product update error:", error);

    if (error.code === "P2002") {
      return NextResponse.json({ error: "A product or variant with this unique identifier already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update catalogue product." }, { status: 500 });
  }
}