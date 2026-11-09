import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";

export async function GET(req: Request) {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    const { searchParams } = new URL(req.url);

    const query = (searchParams.get("q") || "").trim();
    const rawPage = Number(searchParams.get("page") || "1");
    const rawLimit = Number(searchParams.get("limit") || "20");

    if (
      !Number.isSafeInteger(rawPage) ||
      rawPage < 1 ||
      !Number.isSafeInteger(rawLimit) ||
      rawLimit < 1
    ) {
      return NextResponse.json(
        { error: "Invalid pagination parameters." },
        { status: 400 }
      );
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: "Search query is too long." },
        { status: 400 }
      );
    }

    const page = rawPage;
    const limit = Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const where = {
      status: "ACTIVE" as const,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
              { slug: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          category: {
            select: { name: true },
          },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              sku: true,
              price: true,
              compareAtPrice: true,
              attributes: true,
            },
            orderBy: { price: "asc" },
          },
          images: {
            where: { isPrimary: true },
            select: {
              url: true,
              altText: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products: products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
          compareAtPrice:
            variant.compareAtPrice != null
              ? Number(variant.compareAtPrice)
              : null,
        })),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Catalogue search error:", error);

    return NextResponse.json(
      { error: "Failed to search catalogue." },
      { status: 500 }
    );
  }
}