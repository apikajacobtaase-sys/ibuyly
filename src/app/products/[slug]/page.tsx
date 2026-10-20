// src/app/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProductDetailsClient from "@/components/ProductDetailsClient";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  const product = await db.product.findUnique({
    where: { slug },
    select: { 
      title: true, 
      description: true, 
      images: { 
        take: 1, 
        select: { 
          url: true // 👈 FIXED: Removed 'imageUrl' because it doesn't exist in the schema
        } 
      } 
    },
  });

  if (!product) {
    return { title: "Product Not Found | iBUY" };
  }

  const imageUrl = product.images?.[0]?.url || null;

  return {
    title: `${product.title} | iBUY`,
    description: product.description?.substring(0, 160) || "Shop this product on iBUY",
    openGraph: {
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const product = await db.product.findUnique({
      where: { slug },
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
              orderBy: { price: "asc" },
            },
          },
        },
        category: { select: { name: true, slug: true } },
      },
    });

    if (!product) {
      notFound();
    }

    // Format variants to match ProductDetailsClient interface exactly
    const formattedVariants = product.variants.map((v: any) => {
      const offers = v.sellerOffers.map((o: any) => ({
        offerId: o.id,
        sellerId: o.seller.id,
        sellerName: o.seller.businessName,
        price: parseFloat(o.price.toString()),
        stockQuantity: o.stockQuantity,
        status: o.status,
      }));

      return {
        id: v.id,
        name: v.sku || "Default",
        basePrice: parseFloat(v.price.toString()),
        offers: offers,
      };
    });

    const formattedProduct = {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      // 👈 FIXED: Safely map only the 'url' field
      images: product.images.map((img: any) => img.url || ""),
      variants: formattedVariants,
      category: product.category,
      reviews: [], 
      rating: 0,
      reviewCount: 0,
    };

    return <ProductDetailsClient product={formattedProduct} />;
  } catch (error) {
    console.error("🚨 Error fetching product:", error);
    notFound();
  }
}