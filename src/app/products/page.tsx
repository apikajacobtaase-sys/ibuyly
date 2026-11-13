 // src/app/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart, Loader2, GitCompare } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCompareStore } from "@/store/compareStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";
import RecentlyViewed from "@/components/RecentlyViewed";
import { toast } from "sonner";
interface Product {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  imageUrl?: string | null;
  sellerName?: string;
  sellerId?: string;
  stockQuantity: number;
  inStock: boolean;
  bestVariantId?: string;
  bestOfferId?: string | null;
}

export default function AllProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [retryCount, setRetryCount] = useState(0);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [paginationError, setPaginationError] = useState("");
  const { addItem } = useCartStore();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist } = useWishlistStore();

  const {
  addItem: addCompareItem,
  removeItem: removeCompareItem,
  isInCompare,
} = useCompareStore();

useEffect(() => {
  const fetchProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/search?q=&page=1&limit=24", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load products.");
      }

      setProducts(data.products || []);
setPage(1);
setHasMore(Boolean(data.hasMore));
setPaginationError("");
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  fetchProducts();
}, [retryCount]);

const loadMoreProducts = async () => {
  if (loadingMore || !hasMore) return;

  const nextPage = page + 1;

  setLoadingMore(true);
  setPaginationError("");

  try {
    const res = await fetch(
      `/api/search?q=&page=${nextPage}&limit=24`,
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load more products.");
    }

    const newProducts: Product[] = data.products || [];

    setProducts((current) => {
      const existingIds = new Set(current.map((product) => product.id));

      return [
        ...current,
        ...newProducts.filter((product) => !existingIds.has(product.id)),
      ];
    });

    setPage(nextPage);
    setHasMore(Boolean(data.hasMore));
  } catch (error) {
    setPaginationError(
      error instanceof Error
        ? error.message
        : "Unable to load more products."
    );
  } finally {
    setLoadingMore(false);
  }
};

  const formatCurrency = (amount: number | null) =>
  amount == null ? "Price unavailable" : `GH₵${amount.toFixed(2)}`;
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    // ✅ White Background for the whole page
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header Section */}
        <div className="mb-8 border-b border-gray-100 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
          <p className="text-gray-500 mt-1">Discover the best deals from our top sellers.</p>
        </div>
      {error && (
  <div className="rounded-xl border border-red-200 bg-white px-5 py-12 text-center">
    <h3 className="mb-2 text-lg font-bold text-gray-900">
      Unable to load products
    </h3>

    <p className="mb-5 text-sm text-gray-500">{error}</p>

    <button
      onClick={() => setRetryCount((count) => count + 1)}
      className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
    >
      Try Again
    </button>
  </div>
)}
       <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${error ? "hidden" : ""}`}>
          {products.map((product) => {
            const isWishlisted = isInWishlist(product.id);
            const isCompared = isInCompare(product.id);
            
            return (
              // ✅ Clean White Card with Subtle Border
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group relative flex flex-col hover:shadow-lg transition-shadow duration-300">
                
                {/* Wishlist Button */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      if (product.price == null) {
        toast.error("This product has no available price.");
        return;
      }

      if (isWishlisted) {
        removeWishlistItem(product.id);
      } else {
        addWishlistItem({
          id: product.id,
          title: product.title,
          price: product.price,
          imageUrl: product.imageUrl ?? null,
          slug: product.slug,
          sellerName: product.sellerName || "iBUY",
        });
      }
    }}
    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md"
  >
    <Heart className={`w-5 h-5 ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-500"}`} />
  </button>

  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isCompared) {
        removeCompareItem(product.id);
      } else {
        if (product.price == null) {
          toast.error("This product has no available price.");
          return;
        }

        addCompareItem({
          id: product.id,
          title: product.title,
          slug: product.slug,
          imageUrl: product.imageUrl ?? null,
          price: product.price,
        });
      }
    }}
    aria-label={isCompared ? "Remove from comparison" : "Add to comparison"}
    title={isCompared ? "Remove from comparison" : "Add to comparison"}
    className={`w-10 h-10 flex items-center justify-center rounded-full shadow-md ${
      isCompared ? "bg-indigo-600 text-white" : "bg-white text-indigo-600"
    }`}
  >
    <GitCompare className="w-5 h-5" />
  </button>
</div>

                <Link href={`/products/${product.slug}`} className="flex-1 flex flex-col">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.imageUrl ? (
                      <Image 
                        src={product.imageUrl} 
                        alt={product.title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500" 
                        unoptimized 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    {/* ✅ Black Text for Title */}
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 leading-tight">
                      {product.title}
                    </h3>
                    
                    <p className="text-xs text-gray-500 mb-3">{product.sellerName}</p>
                    
                    {/* ✅ Green Price */}
                    <div className="mt-auto">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Add to Cart Button */}
                <div className="p-4 pt-0 mt-auto">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const productPrice = product.price;

if (productPrice == null) {
  toast.error("This product has no available price.");
  return;
}
                      if (!product.bestOfferId || !product.bestVariantId) {
                        toast.error("This product is currently unavailable.");
                        return;
                      }

                      const imgElement = e.currentTarget.closest('.group')?.querySelector('img');
                      if (imgElement) {
                        const rect = getElementRect(imgElement as HTMLElement);
                        triggerFlyToCart({
                          imageUrl: product.imageUrl || '',
                          startX: rect.x,
                          startY: rect.y,
                          id: Date.now().toString(),
                        });
                      }

                      addItem({
                        productId: product.id,
                        variantId: product.bestVariantId,
                        offerId: product.bestOfferId,
                        title: product.title,
                        price: productPrice,
                        imageUrl: product.imageUrl ?? null,
                        stockQuantity: product.stockQuantity,
                        sellerId: product.sellerId || "unknown",
                        sellerName: product.sellerName || "iBUY Marketplace",
                        quantity: 1,
                      });
                    }}
                    disabled={!product.inStock}
                    className={`w-full py-2.5 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${
                      product.inStock 
                        ? "bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md" 
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {product.inStock ? "Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
       {products.length > 0 && hasMore && !error && (
  <div className="flex flex-col items-center gap-3 py-8">
    <button
      onClick={loadMoreProducts}
      disabled={loadingMore}
      className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
      {loadingMore ? "Loading products..." : "Load More Products"}
    </button>

    {paginationError && (
      <div className="text-center">
        <p className="mb-2 text-sm text-red-600">{paginationError}</p>
        <button
          onClick={loadMoreProducts}
          className="text-sm font-semibold text-green-700 underline"
        >
          Try Again
        </button>
      </div>
    )}
  </div>
)}
        {products.length === 0 && !loading && !error && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No products found at the moment.</p>
          </div>
        )}
        <RecentlyViewed />
      </div>
    </div>
  );
}

