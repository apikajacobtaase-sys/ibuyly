 // src/app/page.tsx
"use client";

import React, { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore"; // ✅ Correct Import
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";
import QuantitySelector from "@/components/QuantitySelector";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
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
  const router = useRouter();
  
  // ✅ Use Cart Store for Cart logic
  const { addItem: addCartItem, updateQuantity, removeItem: removeCartItem, items: cartItems } = useCartStore();
  
  // ✅ Use Wishlist Store for Wishlist logic
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist } = useWishlistStore();

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
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
                
                // ✅ Check wishlist status INSIDE the map
                const isWishlisted = isInWishlist(product.id);
                
                const cartItem = cartItems.find((i) => i.offerId === product.bestOfferId);
                const cartQuantity = cartItem?.quantity || 0;

                return (
                  <div
                    key={product.id}
                    ref={isLast ? lastProductRef : null}
                    className="product-card bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition group relative flex flex-col"
                  >
                    {/* ✅ WISHLIST BUTTON */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isWishlisted) {
                          removeWishlistItem(product.id);
                        } else {
                          addWishlistItem({
                            id: product.id,
                            title: product.title,
                            price: product.price,
                            imageUrl: product.imageUrl,
                            slug: product.slug,
                            sellerName: product.sellerName || "iBUY",
                          });
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm hover:shadow-md transition z-10"
                    >
                      <Heart 
                        className={`w-4 h-4 transition ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} 
                      />
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
                            
                            addCartItem({
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