 // src/app/page.tsx
"use client";

import React, { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Heart, ShoppingCart } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useCartStore } from "@/store/cartStore";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";
import QuantitySelector from "@/components/QuantitySelector";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  originalPrice?: number | null; // ✅ Added for discounts
  discountPercent?: number;      // ✅ Added for discounts
  imageUrl?: string | null;
  sellerId?: string;
  sellerName?: string;
  stockQuantity: number;
  inStock: boolean;
  bestVariantId?: string;
  bestOfferId?: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const { addItem, updateQuantity, removeItem, items } = useCartStore();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const observer = useRef<IntersectionObserver | null>(null);
  const lastProductRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreProducts();
        }
      });
      
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  useEffect(() => {
    loadInitialProducts();
  }, []);

  const loadInitialProducts = async () => {
    setLoading(true);
    try {
      await loadProducts(1, true);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await loadProducts(page + 1, false);
    } catch (error) {
      console.error("Failed to load more products:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadProducts = async (pageNum: number, reset: boolean) => {
    try {
      const url = `/api/search?q=&page=${pageNum}&limit=12&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      
      if (data.products && data.products.length > 0) {
        console.log("📦 API Response Sample:", data.products[0]);
      }
      
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
      console.error("💥 Failed to load products:", error);
      setHasMore(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const formatCurrency = (amount: number) => `GH₵ ${amount.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-3 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <ShoppingCart className="w-7 h-7 text-gray-800" strokeWidth={2} />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full border-2 border-white animate-pulse">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>

          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search iBUY"
                className="w-full bg-gray-100 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              />
            </div>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <section className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Popular Products</h2>
            <Link href="/products" className="text-sm font-semibold text-green-600 hover:text-green-700">
              See All
            </Link>
          </div>

          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2" />
                  <div className="h-3 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((product, index) => {
                const isLast = index === products.length - 1;
                const cartItem = items.find((i) => i.offerId === product.bestOfferId);
                const cartQuantity = cartItem?.quantity || 0;

                return (
                  <div
                    key={product.id}
                    ref={isLast ? lastProductRef : null}
                    className="product-card bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition group relative flex flex-col"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        router.push("/login?callbackUrl=/account/wishlist");
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm hover:shadow-md transition z-10"
                    >
                      <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition" />
                    </button>

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
                        
                        {/* ✅ DISCOUNT BADGE */}
                        {product.discountPercent && product.discountPercent > 0 && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            -{product.discountPercent}%
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs text-gray-900 line-clamp-2 mb-1 flex-1 min-h-[2.5rem]">
                        {product.title}
                      </h3>

                      {/* ✅ PRICE & DISCOUNT DISPLAY */}
                      <div className="flex flex-col mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(product.price)}</span>
                          {product.originalPrice && product.originalPrice > product.price && (
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
                            if (cartQuantity <= 1) removeItem(cartItem.id);
                            else updateQuantity(cartItem.id, cartQuantity - 1);
                          }
                        }}
                        size="sm"
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          
                          console.log("🛒 Homepage Click Data:", {
                            id: product.id,
                            bestVariantId: product.bestVariantId,
                            bestOfferId: product.bestOfferId,
                            inStock: product.inStock
                          });

                          if (!product.bestOfferId || !product.bestVariantId) {
                            alert("Error: This product is missing seller information.");
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
                            
                            addItem({
                              productId: product.id,
                              variantId: product.bestVariantId,
                              offerId: product.bestOfferId,
                              title: product.title,
                              price: product.price,
                              imageUrl: product.imageUrl,
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
          
          {!hasMore && products.length > 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">You've reached the end</div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}