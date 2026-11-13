 // src/app/page.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, GitCompare } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore"; // âœ… Correct Import
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";
import QuantitySelector from "@/components/QuantitySelector";
import RecentlyViewed from "@/components/RecentlyViewed";
import { useCompareStore } from "@/store/compareStore";
import { toast } from "sonner";
interface Product {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  originalPrice?: number | null;
  discountPercent?: number;
  imageUrl?: string | null;
  sellerId?: string;
  sellerName?: string;
  stockQuantity: number;
  inStock: boolean;
  bestVariantId?: string;
  bestOfferId?: string | null;
}

export default function HomePage() {

  // âœ… Use Cart Store for Cart logic
  const { addItem: addCartItem, updateQuantity, removeItem: removeCartItem, items: cartItems } = useCartStore();

  // âœ… Use Wishlist Store for Wishlist logic
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist } = useWishlistStore();
const {
  addItem: addCompareItem,
  removeItem: removeCompareItem,
  isInCompare,
} = useCompareStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const [loadMoreError, setLoadMoreError] = useState("");
 const observer = useRef<IntersectionObserver | null>(null);
 const loadingMoreRef = useRef(false);

const lastProductRef = useCallback(
  (node: HTMLDivElement | null) => {
    if (loading || loadingMore || !hasMore || loadMoreError) return;

    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loadMoreError) {
        loadMoreProducts();
      }
    });

    if (node) {
      observer.current.observe(node);
    }
  },
  [loading, loadingMore, hasMore, page, loadMoreError]
);

  useEffect(() => {
    loadInitialProducts();
  }, []);

  const loadInitialProducts = async () => {
  setLoading(true);
  setError("");
    try {
      await loadProducts(1, true);
    } catch (error) {
  console.error("Failed to load products:", error);
  setError("Unable to load products. Please try again.");
  setHasMore(false);
} finally {
      setLoading(false);
    }
  };

const loadMoreProducts = async () => {
  if (loadingMoreRef.current || loadingMore || !hasMore) return;

  loadingMoreRef.current = true;
  setLoadingMore(true);

  try {
    setLoadMoreError("");
    await loadProducts(page + 1, false);
  } finally {
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }
};

  const loadProducts = async (pageNum: number, reset: boolean) => {
    try {
      const url = `/api/search?q=&page=${pageNum}&limit=12&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();

      if (reset) {
        setProducts(data.products || []);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = (data.products || []).filter((p: Product) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }

      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (error) {
  console.error("Failed to load products:", error);

  if (reset) {
    setError("Unable to load products. Please try again.");
    setHasMore(false);
  }

  throw error;
}
  };

 const formatCurrency = (amount: number | null | undefined) =>
  amount == null ? "Price unavailable" : `GH₵${amount.toFixed(2)}`;

  return (
    <div className="min-h-full min-w-0 bg-gray-50 pb-20 md:pb-0">
      <main className="mx-auto w-full max-w-7xl min-w-0">
        <section className="px-0 py-3 sm:px-1 sm:py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Popular Products</h2>
            <Link href="/products" className="text-sm font-semibold text-green-600 hover:text-green-700">
              See All
            </Link>
          </div>

          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2" />
                  <div className="h-3 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
            ) : error && products.length === 0 ? (
  <div className="rounded-xl border border-red-200 bg-white px-5 py-12 text-center">
    <h3 className="mb-2 text-lg font-bold text-gray-900">
      Unable to load products
    </h3>
    <p className="mb-5 text-sm text-gray-500">{error}</p>
    <button
      onClick={loadInitialProducts}
      className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
    >
      Try Again
    </button>
  </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {products.map((product, index) => {
                const isLast = index === products.length - 1;

                // âœ… Check wishlist status INSIDE the map
                const isWishlisted = isInWishlist(product.id);
                const isCompared = isInCompare(product.id);

                const cartItem = cartItems.find((i) => i.offerId === product.bestOfferId);
                const cartQuantity = cartItem?.quantity || 0;

                return (
                  <div
                    key={product.id}
                    ref={isLast ? lastProductRef : null}
                    className="product-card min-w-0 bg-white rounded-lg p-2 sm:p-3 shadow-sm hover:shadow-md transition group relative flex flex-col"
                  >
                    {/* âœ… WISHLIST BUTTON */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isWishlisted) {
        removeWishlistItem(product.id);
      } else {
        if (product.price == null) {
          toast.error("This product currently has no available price.");
          return;
        }

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
    className="w-9 h-9 flex items-center justify-center bg-white rounded-full shadow-md"
  >
    <Heart className={`w-4 h-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-500"}`} />
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
    className={`w-9 h-9 flex items-center justify-center rounded-full shadow-md ${
      isCompared ? "bg-indigo-600 text-white" : "bg-white text-indigo-600"
    }`}
  >
    <GitCompare className="w-4 h-4" />
  </button>
</div>

                    <Link href={`/products/${product.slug}`} className="flex-1 flex flex-col">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden relative">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.title}
                            width={200}
                            height={200}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingCart className="w-8 h-8 text-gray-400" />
                          </div>
                        )}

                        {product.discountPercent && product.discountPercent > 0 && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            -{product.discountPercent}%
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs text-gray-900 line-clamp-2 mb-1 flex-1 min-h-[2.5rem]">
                        {product.title}
                      </h3>

                      <div className="flex flex-col mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(product.price)}</span>
                          {product.price != null && product.originalPrice != null && product.originalPrice > product.price && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatCurrency(product.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {cartQuantity > 0 ? (
                      <QuantitySelector
                        quantity={cartQuantity}
                        maxQuantity={product.stockQuantity}
                        onIncrease={() => {
                          if (cartItem) updateQuantity(cartItem.id, cartQuantity + 1);
                        }}
                        onDecrease={() => {
                          if (cartItem) {
                            if (cartQuantity <= 1) removeCartItem(cartItem.id);
                            else updateQuantity(cartItem.id, cartQuantity - 1);
                          }
                        }}
                        size="sm"
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();

                          if (product.price == null) {
                            alert("This product currently has no available price.");
                            return;
                          }

                          if (!product.bestOfferId || !product.bestVariantId) {
                            toast.error("This product is missing seller information. Please try again later.");
                            return;
                          }

                          if (product.inStock) {
                            const imgElement = e.currentTarget.closest('.product-card')?.querySelector('img');
                            const rect = getElementRect(imgElement as HTMLElement);
                            triggerFlyToCart({
                              imageUrl: product.imageUrl || '',
                              startX: rect.x,
                              startY: rect.y,
                              id: Date.now().toString(),
                            });

                            addCartItem({
                              productId: product.id,
                              variantId: product.bestVariantId,
                              offerId: product.bestOfferId,
                              title: product.title,
                              price: product.price,
                              imageUrl: product.imageUrl ?? null,
                              stockQuantity: product.stockQuantity,
                              sellerId: product.sellerId || "unknown",
                              sellerName: product.sellerName || "iBUY Marketplace",
                              quantity: 1,
                            });
                          }
                        }}
                        disabled={!product.inStock}
                        className={`w-full py-2 text-xs font-semibold rounded-lg transition mt-auto flex items-center justify-center gap-2 ${
                          product.inStock
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {product.inStock ? "Add to Cart" : "Out of Stock"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
          )}

{!loading && !error && products.length === 0 && (
  <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center">
    <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-gray-300" />
    <h3 className="mb-2 text-lg font-bold text-gray-900">
      No products available yet
    </h3>
    <p className="text-sm text-gray-500">
      We're working on bringing you great products. Please check back soon.
    </p>
    <Link
      href="/categories"
      className="mt-5 inline-block rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
    >
      Explore Categories
    </Link>
  </div>
)}


 {loadingMore && (
  <div className="flex justify-center py-6">
    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      Loading more products...
    </div>
  </div>
)}
{loadMoreError && (
  <div className="flex flex-col items-center gap-3 py-6 text-center">
    <p className="text-sm text-red-600">{loadMoreError}</p>
    <button
      onClick={loadMoreProducts}
      disabled={loadingMore}
      className="rounded-lg border border-green-600 px-5 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
    >
      Try Loading Again
    </button>
  </div>
)}
          {!hasMore && products.length > 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">You've reached the end</div>
          )}
          <RecentlyViewed />
        </section>
      </main>

    </div>
  );
}
