 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Check,
  Loader2,
  Store,
  Heart,
  ArrowRight,
  ShieldCheck,
  Truck,
  Package,
} from "lucide-react";

import { useCartStore, CartItem } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  imageUrl?: string | null;
}

export default function CartPage() {
  return <CartContent />;
}

function CartContent() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const toggleSelect = useCartStore((state) => state.toggleSelect);
  const toggleSelectAll = useCartStore((state) => state.toggleSelectAll);
  const syncFromDB = useCartStore((state) => state.syncFromDB);

  const wishlistItems = useWishlistStore((state) => state.items);

  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);

  const formatCurrency = (amount: number) =>
    `GH₵ ${amount.toFixed(2)}`;

  // Selected products
  const selectedItems = items.filter(
    (item) => item.isSelected && item.stockQuantity > 0
  );

  const selectedTotalAmount = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const selectedTotalQuantity = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const selectableItems = items.filter(
    (item) => item.stockQuantity > 0
  );

  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => item.isSelected);

  // Group products by seller
  const sellerGroups = items.reduce(
    (acc, item) => {
      if (!acc[item.sellerId]) {
        acc[item.sellerId] = {
          sellerName: item.sellerName,
          items: [],
        };
      }

      acc[item.sellerId].items.push(item);
      return acc;
    },
    {} as Record<string, { sellerName: string; items: CartItem[] }>
  );
const [currentTime, setCurrentTime] = useState(Date.now());

useEffect(() => {
  const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
  return () => clearInterval(timer);
}, []);

const formatCountdown = (endsAt?: string | null) => {
  if (!endsAt) return null;

  const remaining = new Date(endsAt).getTime() - currentTime;
  if (remaining <= 0) return "Deal ended";

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

  // Load authenticated user's database cart
  useEffect(() => {
    let cancelled = false;

    const fetchLiveCart = async () => {
      try {
        const res = await fetch("/api/cart", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();

            if (!cancelled && Array.isArray(data.items)) {
        syncFromDB(data.items);
      }
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLiveCart();

    return () => {
      cancelled = true;
    };
  }, [syncFromDB]);
useEffect(() => {
  const refreshCart = async () => {
    try {
      const res = await fetch("/api/cart", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) syncFromDB(data.items);
      }
    } catch (error) {
      console.error("Failed to refresh cart:", error);
    }
  };

  const interval = setInterval(refreshCart, 60000);
  return () => clearInterval(interval);
}, [syncFromDB]);

  // Load recommendations
  useEffect(() => {
    let cancelled = false;

    const fetchRecommendations = async () => {
      try {
        const res = await fetch("/api/search?q=&page=1&limit=4");

        if (!res.ok) return;

        const data = await res.json();

        if (!cancelled) {
          setRecommendedProducts(data.products || []);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        if (!cancelled) {
          setRecommendationsLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, []);

  // Remove item
  const handleRemove = async (itemId: string) => {
    removeItem(itemId);

    try {
      await fetch(`/api/cart?itemId=${itemId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Failed to delete cart item:", error);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-green-600" />
      </div>
    );
  }

  // Empty cart
  if (totalQuantity === 0) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="max-w-md mx-auto bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="w-9 h-9 text-green-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            Your cart is empty
          </h1>

          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Looks like you haven't added anything yet.
            Explore our marketplace and discover something you love.
          </p>

          <Link
            href="/categories"
            className="mt-7 inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 transition"
          >
            Start Shopping
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] pb-32 md:pb-12">

      {/* PAGE HEADER */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Shopping Cart
              </h1>

              <p className="text-sm text-gray-500 mt-1">
                {totalQuantity} {totalQuantity === 1 ? "item" : "items"} in your cart
              </p>
            </div>

            <button
              onClick={() => setIsManaging(!isManaging)}
              className="text-sm font-semibold text-green-700 hover:text-green-800 px-3 py-2 rounded-lg hover:bg-green-50 transition"
            >
              {isManaging ? "Done" : "Manage"}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* LEFT: CART CONTENT */}
          <div className="lg:col-span-8 space-y-5">

            {/* SELECT ALL */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-3 text-sm font-medium text-gray-800"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                    allSelected
                      ? "bg-green-600 border-green-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {allSelected && <Check className="w-3.5 h-3.5" />}
                </span>

                Select all
              </button>

              <span className="text-xs text-gray-500">
                {items.length} products
              </span>
            </div>

            {/* SELLER GROUPS */}
            {Object.entries(sellerGroups).map(([sellerId, group]) => (
              <section
                key={sellerId}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* SELLER HEADER */}
                <div className="flex items-center gap-2.5 px-4 py-3.5 bg-gray-50 border-b border-gray-100">
                  <Store className="w-4 h-4 text-gray-500" />

                  <span className="text-sm font-semibold text-gray-900">
                    {group.sellerName}
                  </span>
                </div>

                {/* PRODUCTS */}
                {group.items.map((item) => {
                  const isOutOfStock = item.stockQuantity <= 0;
                  const isLowStock =
                    item.stockQuantity > 0 && item.stockQuantity <= 5;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border-b border-gray-100 last:border-0 ${
                        isOutOfStock ? "bg-gray-50" : ""
                      }`}
                    >
                      <div className="flex gap-3 sm:gap-4">

                        {/* SELECT */}
                        <button
                          onClick={() =>
                            !isOutOfStock && toggleSelect(item.id)
                          }
                          disabled={isOutOfStock}
                          aria-label={`Select ${item.title}`}
                          className="flex-shrink-0 mt-1 disabled:opacity-30"
                        >
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              item.isSelected && !isOutOfStock
                                ? "bg-green-600 border-green-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {item.isSelected && !isOutOfStock && (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </button>

                        {/* IMAGE */}
                        <Link
                          href={`/products/${item.slug || item.productId}`}
                          className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-100"
                        >
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              fill
                              sizes="112px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-7 h-7 text-gray-300" />
                            </div>
                          )}
                        </Link>

                        {/* DETAILS */}
                        <div className="flex-1 min-w-0">

                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/products/${item.slug || item.productId}`}
                              className="min-w-0"
                            >
                              <h3 className="text-sm sm:text-base font-medium text-gray-900 line-clamp-2 hover:text-green-700 transition">
                                {item.title}
                              </h3>
                            </Link>

                            {isManaging && (
                              <button
                                onClick={() => handleRemove(item.id)}
                                aria-label={`Remove ${item.title}`}
                                className="p-2 -mr-2 -mt-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* STOCK STATUS */}
                          <div className="mt-2">
                            {isOutOfStock ? (
                              <span className="text-xs font-medium text-red-600">
                                Out of stock
                              </span>
                            ) : isLowStock ? (
                              <span className="text-xs font-medium text-orange-600">
                                Only {item.stockQuantity} left
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-green-700">
                                In stock
                              </span>
                            )}
                          </div>

                         {/* PRICE + QUANTITY */}
<div className="flex items-end justify-between gap-2 mt-3">
  <div>
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-base sm:text-lg font-bold text-gray-900">
        {formatCurrency(item.price * item.quantity)}
      </p>

      {item.originalPrice && item.originalPrice > item.price && (
        <span className="text-xs text-gray-400 line-through">
          {formatCurrency(item.originalPrice * item.quantity)}
        </span>
      )}
    </div>

              <p className="text-xs text-gray-400 mt-0.5">
                {formatCurrency(item.price)} / unit
              </p>

              {item.originalPrice && item.originalPrice > item.price && (
                <div className="mt-2 space-y-1">
                  <span className="inline-block bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded">
                    FLASH DEAL
                  </span>

                  {item.dealEndsAt && (
                    <p className="text-[11px] font-semibold text-red-600">
                      Ends in {formatCountdown(item.dealEndsAt)}
                    </p>
                  )}
                </div>
              )}
            </div>

                {/* QUANTITY CONTROL */}
                <div className="flex items-center border border-gray-200 rounded-lg h-9">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1 || isOutOfStock}
                    aria-label="Decrease quantity"
                    className="w-9 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg disabled:opacity-30"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-8 text-center text-sm font-semibold text-gray-900">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={
                      item.quantity >= item.stockQuantity || isOutOfStock
                    }
                    aria-label="Increase quantity"
                    className="w-9 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
                                      </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}

            {/* CONTINUE SHOPPING */}
            <Link
              href="/categories"
              className="inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800 transition"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Continue shopping
            </Link>

            {/* RECOMMENDATIONS */}
            <section className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    You might also like
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Discover more from our marketplace
                  </p>
                </div>
              </div>

              {recommendationsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-100 p-2 animate-pulse"
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg" />
                      <div className="h-3 bg-gray-100 rounded mt-3 w-3/4" />
                      <div className="h-3 bg-gray-100 rounded mt-2 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : recommendedProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recommendedProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition group"
                    >
                      <div className="relative aspect-square bg-gray-50">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-7 h-7 text-gray-300" />
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <h3 className="text-xs font-medium text-gray-800 line-clamp-2">
                          {product.title}
                        </h3>

                        <p className="text-sm font-bold text-gray-900 mt-2">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>

            {/* SAVED ITEMS */}
            {wishlistItems.length > 0 && (
              <section className="pt-3">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Saved for later
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Products in your wishlist
                    </p>
                  </div>

                  <Link
                    href="/account/wishlist"
                    className="text-sm font-semibold text-green-700"
                  >
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {wishlistItems.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.slug}`}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
                    >
                      <div className="relative aspect-square bg-gray-50">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Heart className="w-7 h-7 text-gray-300" />
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <h3 className="text-xs font-medium text-gray-800 line-clamp-2">
                          {item.title}
                        </h3>

                        <p className="text-sm font-bold text-gray-900 mt-2">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* RIGHT: ORDER SUMMARY */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 space-y-4">

              <div className="bg-white border border-gray-200 rounded-xl p-5">

                <h2 className="text-lg font-bold text-gray-900 mb-5">
                  Order Summary
                </h2>

                <div className="space-y-4 text-sm">

                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Selected items ({selectedTotalQuantity})
                    </span>

                    <span className="font-semibold text-gray-900">
                      {formatCurrency(selectedTotalAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Delivery fee
                    </span>

                    <span className="text-gray-500 text-xs">
                      Calculated at checkout
                    </span>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">
                        Subtotal
                      </span>

                      <span className="text-xl font-bold text-gray-900">
                        {formatCurrency(selectedTotalAmount)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      Delivery charges and discounts are finalized at checkout.
                    </p>
                  </div>

                </div>

                <Link
                  href={selectedItems.length > 0 ? "/checkout" : "#"}
                  aria-disabled={selectedItems.length === 0}
                  onClick={(e) => {
                    if (selectedItems.length === 0) e.preventDefault();
                  }}
                  className={`mt-6 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition ${
                    selectedItems.length > 0
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Proceed to checkout
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    Secure checkout
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Truck className="w-4 h-4 text-green-600" />
                    Delivery options at checkout
                  </div>

                </div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-900">
                  Shopping with confidence
                </p>

                <p className="text-xs text-green-800 mt-1 leading-relaxed">
                  Review your products and quantities before proceeding to checkout.
                </p>
              </div>

            </div>
          </aside>

        </div>
      </main>

      {/* MOBILE CHECKOUT BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              Subtotal ({selectedTotalQuantity} items)
            </p>

            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(selectedTotalAmount)}
            </p>

            <p className="text-[10px] text-gray-400">
              Delivery calculated at checkout
            </p>
          </div>

          <Link
            href={selectedItems.length > 0 ? "/checkout" : "#"}
            aria-disabled={selectedItems.length === 0}
            onClick={(e) => {
              if (selectedItems.length === 0) e.preventDefault();
            }}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition ${
              selectedItems.length > 0
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Checkout
            <ArrowRight className="w-4 h-4" />
          </Link>

        </div>
      </div>

    </div>
  );
}