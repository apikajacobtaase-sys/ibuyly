 import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const products = await db.product.findMany({
      where: {
        status: "PENDING_REVIEW",
      },
      include: {
        seller: {
          select: {
            businessName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        variants: {
          include: {
            sellerOffers: {
              select: {
                id: true,
                sellerId: true,
                price: true,
                stockQuantity: true,
                sellerSku: true,
                status: true,
              },
            },
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 100,
    });

    return NextResponse.json({
      submissions: products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
          compareAtPrice: variant.compareAtPrice
            ? Number(variant.compareAtPrice)
            : null,
          costPrice: variant.costPrice
            ? Number(variant.costPrice)
            : null,
          sellerOffers: variant.sellerOffers.map((offer) => ({
            ...offer,
            price: Number(offer.price),
          })),
        })),
      })),
    });
  } catch (error) {
    console.error("Admin submissions GET error:", error);

    return NextResponse.json(
      { error: "Failed to retrieve product submissions." },
      { status: 500 }
    );
  }
}

const ReviewSchema = z.discriminatedUnion("action", [
  z.object({
    productId: z.string().cuid(),
    action: z.literal("APPROVE"),
  }),
  z.object({
    productId: z.string().cuid(),
    action: z.literal("REJECT"),
    reason: z.string().trim().min(5).max(2000),
  }),
]);

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const validation = ReviewSchema.safeParse(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid review information.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: {
          id: data.productId,
        },
        include: {
          variants: {
            include: {
              sellerOffers: true,
            },
          },
        },
      });

      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      if (product.status !== "PENDING_REVIEW") {
        throw new Error("PRODUCT_ALREADY_REVIEWED");
      }

      const now = new Date();

      if (data.action === "REJECT") {
        await tx.product.update({
          where: {
            id: product.id,
          },
          data: {
            status: "REJECTED",
            reviewNote: data.reason,
            reviewedAt: now,
            reviewedById: user.id,
          },
        });

        await tx.productVariant.updateMany({
          where: {
            productId: product.id,
          },
          data: {
            isActive: false,
          },
        });

        await tx.sellerOffer.updateMany({
          where: {
            sellerId: product.submittedBySellerId!,
            variantId: {
              in: product.variants.map((variant) => variant.id),
            },
          },
          data: {
            status: "PAUSED",
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "PRODUCT_SUBMISSION_REJECTED",
            resourceType: "Product",
            resourceId: product.id,
            metadata: {
              title: product.title,
              sellerId: product.submittedBySellerId,
              reason: data.reason,
            },
          },
        });

        return {
          action: "REJECTED",
          productId: product.id,
          reviewNote: data.reason,
        };
      }

      // Prevent duplicate catalogue products.
      const duplicate = await tx.product.findFirst({
        where: {
          id: { not: product.id },
          categoryId: product.categoryId,
          title: {
            equals: product.title,
            mode: "insensitive",
          },
          status: {
            in: ["ACTIVE", "OUT_OF_STOCK"],
          },
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (duplicate) {
        throw new Error("DUPLICATE_CATALOGUE_PRODUCT");
      }

      const totalStock = product.variants.reduce(
        (total, variant) => total + variant.stockQuantity,
        0
      );

      const productStatus =
        totalStock > 0 ? "ACTIVE" : "OUT_OF_STOCK";

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          sellerId: null,
          status: productStatus,
          reviewNote: null,
          reviewedAt: now,
          reviewedById: user.id,
        },
      });

      for (const variant of product.variants) {
        const hasStock = variant.stockQuantity > 0;

        await tx.productVariant.update({
          where: {
            id: variant.id,
          },
          data: {
            isActive: hasStock,
          },
        });

        await tx.sellerOffer.updateMany({
          where: {
            sellerId: product.submittedBySellerId!,
            variantId: variant.id,
          },
          data: {
            status: hasStock ? "ACTIVE" : "OUT_OF_STOCK",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PRODUCT_SUBMISSION_APPROVED",
          resourceType: "Product",
          resourceId: product.id,
          metadata: {
            title: product.title,
            sellerId: product.submittedBySellerId,
            productStatus,
            totalStock,
          },
        },
      });

      return {
        action: "APPROVED",
        productId: product.id,
        productStatus,
      };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Admin product review error:", error);

    if (error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Product submission not found." },
        { status: 404 }
      );
    }

    if (error.message === "PRODUCT_ALREADY_REVIEWED") {
      return NextResponse.json(
        { error: "This product has already been reviewed." },
        { status: 409 }
      );
    }

    if (error.message === "DUPLICATE_CATALOGUE_PRODUCT") {
      return NextResponse.json(
        {
          error: "A catalogue product with this title and category already exists. Review the existing product before approving this submission.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process product review." },
      { status: 500 }
    );
  }
}