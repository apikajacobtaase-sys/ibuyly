 // src/app/search/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link"
import ProductCard from "@/components/ProductCard";

// 1. Move all your existing search logic and JSX into this component
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

 
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);
useEffect(() => {
  if (query.trim()) {
    fetchProducts();
  } else {
    setProducts([]);
    setError("");
    setHasMore(false);
    setPage(1);
  }
}, [query, sort]);

 const fetchProducts = async () => {
  setIsLoading(true);
  setError("");
  setPage(1);

  try {
    const params = new URLSearchParams({
      search: query,
      sort,
      page: "1",
      limit: "24",
    });

    const res = await fetch(`/api/products?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to search products.");
    }

    setProducts(data.products || []);
    setHasMore(data.hasMore ?? false);
  } catch (error) {
    console.error("Search failed", error);
    setError(
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again."
    );
    setProducts([]);
    setHasMore(false);
  } finally {
    setIsLoading(false);
  }
};

 const loadMoreProducts = async () => {
  if (isLoadingMore || !hasMore) return;

  const nextPage = page + 1;
  setIsLoadingMore(true);

  try {
    const params = new URLSearchParams({
      search: query,
      sort,
      page: String(nextPage),
      limit: "24",
    });

    const res = await fetch(`/api/products?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load more products.");
    }

    setProducts((previous) => {
      const existingIds = new Set(previous.map((product) => product.id));

      const newProducts = (data.products || []).filter(
        (product: any) => !existingIds.has(product.id)
      );

      return [...previous, ...newProducts];
    });

    setPage(nextPage);
    setHasMore(data.hasMore ?? false);
  } catch (error) {
    console.error("Failed to load more products:", error);
  } finally {
    setIsLoadingMore(false);
  }
};

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">


      <div className="max-w-7xl mx-auto px-4 py-6">
        {query && (
          <div className="mb-6">
            <h1 className="mb-2 text-lg font-extrabold text-ibuy-text sm:text-xl">
              Search results for &quot;{query}&quot;
            </h1>
            <p className="mb-3 text-sm text-ibuy-text-secondary">
  {products.length} {products.length === 1 ? "product" : "products"} found
</p>
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
                <option value="rating">Top Rated</option>
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
        ) : error ? (
  <div className="rounded-xl border border-red-200 bg-ibuy-card px-5 py-12 text-center">
    <h3 className="mb-2 text-lg font-bold text-ibuy-text">
      Search failed
    </h3>

    <p className="mb-5 text-sm text-ibuy-text-secondary">
      {error}
    </p>

    <button
      onClick={fetchProducts}
      className="rounded-lg bg-ibuy-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ibuy-orange-hover"
    >
      Try Again
    </button>
  </div>
) : products.length === 0 ? (
          <div className="rounded-xl border border-ibuy-border bg-ibuy-card px-5 py-12 text-center">
  <h3 className="mb-2 text-xl font-bold text-ibuy-text">
    {query ? "No products found" : "What are you looking for?"}
  </h3>

  <p className="mb-6 text-sm text-ibuy-text-secondary">
    {query
  ? "Try different keywords or browse our categories."
  : "Search for products using the search bar above, or explore our categories."}
  </p>

  <Link
    href="/categories"
    className="inline-block rounded-lg bg-ibuy-orange px-6 py-3 font-semibold text-white transition hover:bg-ibuy-orange-hover"
  >
    Browse Categories
  </Link>
</div>
        ) : (
  <>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>

    {hasMore && (
      <div className="mt-8 flex justify-center">
        <button
          onClick={loadMoreProducts}
          disabled={isLoadingMore}
          className="rounded-lg border border-ibuy-border bg-ibuy-card px-6 py-3 text-sm font-semibold text-ibuy-text transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingMore ? (
  <span className="flex items-center gap-2">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    Loading products...
  </span>
) : (
  "Load More Products"
)}
        </button>
      </div>
    )}
  </>
)}
      </div>

      
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