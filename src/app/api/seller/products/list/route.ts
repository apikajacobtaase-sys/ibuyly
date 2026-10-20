// src/app/api/seller/products/list/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const sort = searchParams.get("sort") || "newest";

    const where: any = { sellerId: sellerProfile.id };

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    if (status && ["ACTIVE", "DRAFT", "ARCHIVED", "OUT_OF_STOCK"].includes(status)) {
      where.status = status;
    }

    const orderBy: any = { createdAt: "desc" };
    if (sort === "name_asc") orderBy.title = "asc";
    if (sort === "name_desc") orderBy.title = "desc";
    if (sort === "oldest") orderBy.createdAt = "asc";

    const products = await db.product.findMany({
      where,
      include: {
        variants: { take: 1 },
        images: { where: { isPrimary: true }, take: 1 },
        category: { select: { name: true } },
        _count: { select: { reviews: true } },
      },
      orderBy,
    });

    return NextResponse.json({
      products: products.map((p) => {
        const variant = p.variants[0];
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          price: variant?.price ? parseFloat(variant.price.toString()) : 0,
          stock: variant?.stockQuantity || 0,
          imageUrl: p.images[0]?.url || null,
          categoryName: p.category.name,
          reviewCount: p._count.reviews,
          createdAt: p.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Seller products fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}