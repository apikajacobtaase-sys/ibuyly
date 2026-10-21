"use client";

import { useEffect, useState } from "react";
import { useCompareStore } from "@/store/compareStore";
import Link from "next/link";
import Image from "next/image";
import { X, Star, ShieldCheck } from "lucide-react";

interface ProductData {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  attributes: any;
  sellerName: string;
  sellerVerified: boolean;
  sellerTrustScore?: number | null;
  sellerRating?: number | null;
  categoryName: string;
  avgRating?: number | null;
  reviewCount: number;
  createdAt: string;
}

export default function ComparePage() {
  const { items, removeItem, clearCompare } = useCompareStore();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (items.length > 0) {
      fetchComparisonData();
    } else {
      setIsLoading(false);
    }
  }, [items]);

  const fetchComparisonData = async () => {
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: items.map((i) => i.id) }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Failed to fetch comparison data", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ibuy-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ibuy-orange"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
        <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/" className="text-ibuy-orange hover:underline">← Back</Link>
            <h1 className="text-xl font-bold text-ibuy-text">Compare Products</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-ibuy-text mb-2">No products to compare</h2>
          <p className="text-ibuy-text-secondary mb-6">Add products to compare by clicking the purple compare icon on product cards</p>
          <Link href="/" className="inline-block bg-ibuy-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition">
            Browse Products
          </Link>
        </div>
        
      </div>
    );
  }

  const allAttributeKeys = new Set<string>();
  products.forEach((p) => {
    if (p.attributes && typeof p.attributes === "object") {
      Object.keys(p.attributes).forEach((key) => allAttributeKeys.add(key));
    }
  });

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-gray-400 italic text-xs">Not provided</span>;
    }
    if (typeof value === "boolean") {
      return value ? <span className="text-green-600 text-xs">✓ Yes</span> : <span className="text-red-600 text-xs">✗ No</span>;
    }
    return <span className="text-xs">{String(value)}</span>;
  };

  const isDifferent = (key: string, values: any[]) => {
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
    if (nonNullValues.length === 0) return false;
    const first = JSON.stringify(nonNullValues[0]);
    return nonNullValues.some((v) => JSON.stringify(v) !== first);
  };

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-ibuy-orange hover:underline text-sm">← Back</Link>
            <h1 className="text-lg font-bold text-ibuy-text">Compare Products</h1>
          </div>
          <button
            onClick={clearCompare}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 md:px-4 py-4">
        {/* Product Headers - Compact */}
        <div className="bg-ibuy-card rounded-lg border border-ibuy-border overflow-hidden mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
            {products.map((product) => (
              <div key={product.id} className="relative p-3 border-r border-ibuy-border last:border-r-0">
                <button
                  onClick={() => removeItem(product.id)}
                  className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <Link href={`/products/${product.slug}`}>
                  <div className="relative aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📦</div>
                    )}
                  </div>
                  <h3 className="font-semibold text-ibuy-text text-xs line-clamp-2 mb-1 hover:text-ibuy-orange transition">
                    {product.title}
                  </h3>
                </Link>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-ibuy-orange">
                    GH₵ {product.price.toFixed(2)}
                  </p>
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <p className="text-[10px] text-gray-400 line-through">
                      GH₵ {product.compareAtPrice.toFixed(2)}
                    </p>
                  )}
                  <p className={`text-[10px] font-medium ${product.stockQuantity > 0 ? "text-green-600" : "text-red-600"}`}>
                    {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : "Out of stock"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Table - Compact */}
        <div className="bg-ibuy-card rounded-lg border border-ibuy-border overflow-hidden">
          {/* Basic Info Section */}
          <div className="border-b-2 border-ibuy-border">
            <div className="bg-ibuy-intelligence/10 px-3 py-1.5 border-b border-ibuy-border">
              <h3 className="font-bold text-ibuy-intelligence text-xs">Basic Information</h3>
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-[10px] text-gray-500 mb-0.5">Category</p>
                  <p className="text-xs text-ibuy-text">{product.categoryName}</p>
                </div>
              ))}
            </div>

            {/* Rating */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-[10px] text-gray-500 mb-0.5">Rating</p>
                  {product.avgRating ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium text-ibuy-text">{product.avgRating}</span>
                      <span className="text-[10px] text-gray-500">({product.reviewCount})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No reviews</span>
                  )}
                </div>
              ))}
            </div>

            {/* Seller */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-[10px] text-gray-500 mb-0.5">Seller</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-ibuy-text">{product.sellerName}</span>
                    {product.sellerVerified && (
                      <ShieldCheck className="w-3 h-3 text-ibuy-intelligence" title="Verified Seller" />
                    )}
                  </div>
                  {product.sellerTrustScore && (
                    <p className="text-[10px] text-gray-500 mt-0.5">Trust: {product.sellerTrustScore}/100</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Attributes Section */}
          {allAttributeKeys.size > 0 && (
            <div className="border-b-2 border-ibuy-border">
              <div className="bg-ibuy-orange/10 px-3 py-1.5 border-b border-ibuy-border">
                <h3 className="font-bold text-ibuy-orange text-xs">Specifications</h3>
              </div>
              {Array.from(allAttributeKeys).map((key) => {
                const values = products.map((p) => p.attributes?.[key]);
                const different = isDifferent(key, values);

                return (
                  <div key={key} className={`grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border ${different ? "bg-yellow-50" : ""}`}>
                    {products.map((product, idx) => (
                      <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                        <p className="text-[10px] text-gray-500 mb-0.5 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                          {different && idx === 0 && <span className="ml-1 text-ibuy-orange">⚡</span>}
                        </p>
                        {renderValue(product.attributes?.[key])}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Description Section */}
          <div>
            <div className="bg-gray-100 px-3 py-1.5 border-b border-ibuy-border">
              <h3 className="font-bold text-ibuy-text text-xs">Description</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-xs text-ibuy-text line-clamp-3">{product.description || "No description"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-ibuy-card rounded-lg border border-ibuy-border p-3">
          <h4 className="font-semibold text-ibuy-text text-xs mb-2">Legend</h4>
          <div className="flex flex-wrap gap-3 text-[10px] text-ibuy-text-secondary">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-50 border border-yellow-200 rounded"></div>
              <span>Differences</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-ibuy-orange">⚡</span>
              <span>Key difference</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-ibuy-intelligence" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}