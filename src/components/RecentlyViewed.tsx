"use client";

import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import ProductCard from "./ProductCard";
import { Star } from "lucide-react";

export default function RecentlyViewed() {
  const items = useRecentlyViewedStore((state) => state.items);

  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-ibuy-text">Recently Viewed</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
        {items.slice(0, 5).map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            title={product.title}
            slug={product.slug}
            price={product.price}
            imageUrl={product.imageUrl}
          />
        ))}
      </div>
    </section>
  );
}