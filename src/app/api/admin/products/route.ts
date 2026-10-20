// src/app/api/admin/products/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

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
      sellerName: item.offer?.seller?.businessName || "Seller information unavailable",
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