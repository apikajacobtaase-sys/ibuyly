 // src/app/search/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BottomNav from "@/components/BottomNav";

// 1. Move all your existing search logic and JSX into this component
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(query);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    if (query) {
      fetchProducts();
    }
  }, [query, sort]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products?search=${query}&sort=${sort}`);
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchInput)}`;
    }
  };

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2.5 bg-ibuy-bg border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-ibuy-orange text-white rounded-lg font-medium hover:bg-ibuy-orange-hover transition"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {query && (
          <div className="mb-6">
            <h1 className="text-xl font-bold text-ibuy-text mb-2">
              Search results for "{query}"
            </h1>
            <div className="flex items-center gap-3">
              <label className="text-sm text-ibuy-text-secondary">Sort by:</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-1.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        )}

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
            <p className="text-ibuy-text-secondary mb-6">
              Try different keywords or browse our categories
            </p>
            <Link
              href="/categories"
              className="inline-block bg-ibuy-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition"
            >
              Browse Categories
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// 2. Wrap the component in <Suspense> in the default export
export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ibuy-bg flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ibuy-orange"></div>
        <p className="ml-3 text-ibuy-text-secondary">Searching...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}