 // src/app/api/products/[slug]/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const product = await db.product.findUnique({
      where: { slug, status: "ACTIVE" },
      include: {
        images: { orderBy: { isPrimary: "desc" } },
        variants: {
          where: { isActive: true },
          include: {
            sellerOffers: {
              where: { status: "ACTIVE" },
              include: {
                seller: { select: { id: true, businessName: true } },
              },
              orderBy: { price: "asc" }, // Cheapest first
            },
          },
        },
        category: { select: { name: true, slug: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Format variants to include their specific seller offers
    const formattedVariants = product.variants.map((v) => {
      const offers = v.sellerOffers.map((o) => ({
        offerId: o.id,
        sellerId: o.seller.id,
        sellerName: o.seller.businessName,
        price: parseFloat(o.price.toString()),
        stockQuantity: o.stockQuantity,
        status: o.status,
      }));

      return {
        id: v.id,
        name: v.sku || "Default Variant",
        basePrice: parseFloat(v.price.toString()),
        offers: offers,
      };
    });

    return NextResponse.json({
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        images: product.images.map((img) => img.url || img.imageUrl),
        variants: formattedVariants,
        category: product.category,
      },
    });
  } catch (error: any) {
    console.error("🚨 Product details API error:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}