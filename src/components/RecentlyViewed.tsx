 "use client";

import { useEffect, useState } from "react";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import ProductCard from "./ProductCard";

interface RecentlyViewedProduct {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  originalPrice: number | null;
  imageUrl: string | null;
  stockQuantity: number;
  bestOfferId: string | null;
  bestVariantId: string | null;
  sellerName: string;
  sellerLogoUrl: string | null;
  avgRating: number;
  reviewCount: number;
}

export default function RecentlyViewed() {
  const items = useRecentlyViewedStore((state) => state.items);
  const [products, setProducts] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentlyViewed() {
      if (items.length === 0) {
        setProducts([]);
        return;
      }

      try {
        const res = await fetch("/api/products/recently-viewed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productIds: items.slice(0, 10).map((item) => item.id),
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch recently viewed products.");
        }

        const data = await res.json();

        if (!cancelled) {
          setProducts(data.products ?? []);
        }
      } catch (error) {
        console.error("Recently viewed products error:", error);
      }
    }

    fetchRecentlyViewed();

    return () => {
      cancelled = true;
    };
  }, [items]);

  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-ibuy-text">
          Recently Viewed
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
        {products.slice(0, 5).map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            title={product.title}
            slug={product.slug}
            price={product.price ?? 0}
            compareAtPrice={product.originalPrice}
            imageUrl={product.imageUrl}
            stockQuantity={product.stockQuantity}
            bestOfferId={product.bestOfferId}
            bestVariantId={product.bestVariantId}
            sellerName={product.sellerName}
            sellerLogoUrl={product.sellerLogoUrl}
            avgRating={product.avgRating}
            reviewCount={product.reviewCount}
          />
        ))}
      </div>
    </section>
  );
}