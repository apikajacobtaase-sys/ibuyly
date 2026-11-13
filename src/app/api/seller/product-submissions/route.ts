 import { db } from "@/lib/db";
import { authorizeSeller } from "@/lib/seller-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";

const SubmissionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(10000),
  categoryId: z.string().cuid(),
  price: z.number().positive().finite(),
  stockQuantity: z.number().int().min(0).max(100000),
  sellerSku: z.string().trim().min(2).max(100).optional().or(z.literal("")),
  images: z.array(
    z.object({
      url: z.string().url(),
      altText: z.string().max(300).optional().nullable(),
    })
  ).min(1).max(10),
});

export async function GET() {
  try {
    const auth = await authorizeSeller("manage_products");
    if (!auth.authorized) return auth.response;

    const products = await db.product.findMany({
      where: {
        submittedBySellerId: auth.sellerId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
        category: {
          select: { name: true },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stockQuantity: true,
            sellerOffers: {
              where: { sellerId: auth.sellerId },
              select: {
                id: true,
                status: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            url: true,
            altText: true,
            isPrimary: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      submissions: products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
          sellerOffers: variant.sellerOffers.map((offer) => ({
            ...offer,
            price: Number(offer.price),
          })),
        })),
      })),
    });
  } catch (error) {
    console.error("Seller submissions GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve product submissions." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeSeller("manage_products");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const validation = SubmissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid product information.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      categoryId,
      price,
      stockQuantity,
      sellerSku,
      images,
    } = validation.data;

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      return NextResponse.json(
        { error: "Please select an active category." },
        { status: 400 }
      );
    }

    const duplicate = await db.product.findFirst({
      where: {
        submittedBySellerId: auth.sellerId,
        categoryId,
        title: { equals: title, mode: "insensitive" },
        status: { in: ["PENDING_REVIEW", "ACTIVE"] },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "You have already submitted this product." },
        { status: 409 }
      );
    }

    if (sellerSku) {
      const existingSku = await db.sellerOffer.findUnique({
        where: { sellerSku },
        select: { id: true },
      });

      if (existingSku) {
        return NextResponse.json(
          { error: "This seller SKU is already in use." },
          { status: 409 }
        );
      }
    }

    const slugBase = title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 150) || "product";

    const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;
    const variantSku = `IBUY-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    const normalizedImages = images.map((image, index) => ({
      url: image.url,
      altText: image.altText || null,
      sortOrder: index,
      isPrimary: index === 0,
    }));

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sellerId: auth.sellerId,
          submittedBySellerId: auth.sellerId,
          title,
          description,
          slug,
          categoryId,
          status: "PENDING_REVIEW",
          variants: {
            create: {
              sku: variantSku,
              price,
              stockQuantity,
              isActive: false,
            },
          },
          images: {
            create: normalizedImages,
          },
        },
        include: {
          variants: true,
          images: true,
          category: {
            select: { id: true, name: true },
          },
        },
      });

      const variant = created.variants[0];

      await tx.sellerOffer.create({
        data: {
          sellerId: auth.sellerId,
          variantId: variant.id,
          price,
          stockQuantity,
          sellerSku: sellerSku || null,
          condition: "NEW",
          status: "PAUSED",
        },
      });

      return created;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Product submitted successfully. Awaiting admin review.",
        product,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Seller product submission error:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A product SKU or seller SKU already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit product." },
      { status: 500 }
    );
  }
}