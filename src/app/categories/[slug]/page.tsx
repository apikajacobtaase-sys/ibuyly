"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/ProductCard";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  sellerName?: string;
  stockQuantity: number;
  category: { name: string; slug: string };
}

export default function CategoryProductsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          category: slug,
          sort,
          ...(minPrice && { minPrice }),
          ...(maxPrice && { maxPrice }),
        });

        const res = await fetch(`/api/products?${queryParams}`);
        const data = await res.json();

        if (res.ok) {
          setProducts(data.products || []);
          if (data.products?.length > 0) {
            setCategoryName(data.products[0].category.name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, [slug, sort, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-ibuy-text-secondary mb-2">
            <Link href="/" className="hover:text-ibuy-orange">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/categories" className="hover:text-ibuy-orange">Categories</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-ibuy-text font-medium">{categoryName || "Loading..."}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-ibuy-text">{categoryName}</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden flex items-center gap-2 px-3 py-2 bg-ibuy-bg rounded-lg text-sm font-medium"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters Panel */}
        <div className={`${showFilters ? "block" : "hidden"} md:block mb-6 bg-ibuy-card rounded-lg border border-ibuy-border p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-2">Sort By</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full px-3 py-2 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-2">Min Price (GH₵)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-2">Max Price (GH₵)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="10000"
                className="w-full px-3 py-2 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
              />
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-ibuy-card rounded-lg border border-ibuy-border animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-2 space-y-2">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-ibuy-card rounded-lg border border-ibuy-border">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-ibuy-text mb-2">No products found</h3>
            <p className="text-ibuy-text-secondary">Try adjusting your filters or browse other categories</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}
      </div>


    </div>
  );
}