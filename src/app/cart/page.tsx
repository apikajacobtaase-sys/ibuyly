 // src/app/cart/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ShoppingCart, Minus, Plus, Trash2, 
  CheckSquare, Square, Loader2, MapPin, Store, Heart 
} from "lucide-react";
import { useCartStore, CartItem } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import AuthGuard from "@/components/AuthGuard";

export default function CartPage() {
  return (
    <AuthGuard>
      <CartContent />
    </AuthGuard>
  );
}

function CartContent() {
  // 1. Extract actions and state
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const toggleSelect = useCartStore((state) => state.toggleSelect);
  const toggleSelectAll = useCartStore((state) => state.toggleSelectAll);
  const syncFromDB = useCartStore((state) => state.syncFromDB);
  
  const wishlistItems = useWishlistStore((state) => state.items);

  // 2. Derived state
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItems = items.filter((i) => i.isSelected && i.stockQuantity > 0);
  const selectedTotalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedTotalAmount = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [deliveryFee] = useState(15.00); 

  // ✅ FIX: Sync with Database on load
  useEffect(() => {
    const fetchLiveCart = async () => {
      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          if (data.items && syncFromDB) {
            syncFromDB(data.items);
          }
        }
      } catch (error) {
        console.error("Failed to fetch live cart", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLiveCart();
  }, [syncFromDB]);

  // Group items by seller
  const sellerGroups = items.reduce((acc, item) => {
    if (!acc[item.sellerId]) {
      acc[item.sellerId] = { sellerName: item.sellerName, items: [] };
    }
    acc[item.sellerId].items.push(item);
    return acc;
  }, {} as Record<string, { sellerName: string; items: CartItem[] }>);

  const formatCurrency = (amount: number) => `GH₵ ${amount.toFixed(2)}`;
  const allSelected = items.length > 0 && items.every((i) => i.isSelected && i.stockQuantity > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-6">
          <ShoppingCart className="w-16 h-16 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6 max-w-sm">Discover great deals and add your favorite items to get started.</p>
        <Link href="/categories" className="w-full max-w-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
      {/* HEADER - No Back Arrow */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-lg font-bold text-gray-900">Shopping Cart ({totalItems})</h1>
        <button 
          onClick={() => setIsManaging(!isManaging)}
          className="text-sm font-semibold text-green-600 hover:text-green-700"
        >
          {isManaging ? "Done" : "Manage"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:grid md:grid-cols-3 md:gap-6">
        
        {/* LEFT COLUMN: CART ITEMS & RECOMMENDATIONS */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Select All Bar */}
          <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-green-600">
              {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </button>
            <span className="text-sm font-medium text-gray-700">Select All ({items.length} items)</span>
          </div>

          {/* Seller Groups */}
          {Object.entries(sellerGroups).map(([sellerId, group]) => (
            <div key={sellerId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                <Store className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">{group.sellerName}</span>
              </div>
              
              {group.items.map((item) => {
                const isOutOfStock = item.stockQuantity === 0;
                return (
                  <div key={item.id} className={`p-4 flex gap-4 border-b border-gray-100 last:border-0 ${isOutOfStock ? "opacity-60 bg-gray-50" : ""}`}>
                    {/* Checkbox */}
                    <div className="flex items-center pt-2">
                      <button 
                        onClick={() => !isOutOfStock && toggleSelect(item.id)}
                        disabled={isOutOfStock}
                        className="text-green-600 disabled:text-gray-300"
                      >
                        {item.isSelected && !isOutOfStock ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Image */}
                    <Link href={`/products/${item.slug || item.productId}`} className="flex-shrink-0">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden relative">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.title} fill className="object-cover" unoptimized />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ShoppingCart className="w-6 h-6 text-gray-400" /></div>
                        )}
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${item.slug || item.productId}`}>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-green-600">{item.title}</h3>
                      </Link>
                      
                      {/* Stock Status Badge */}
                      {isOutOfStock ? (
                        <p className="text-xs text-red-600 font-medium mt-1">Out of Stock</p>
                      ) : item.stockQuantity <= 5 ? (
                        <p className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          Only {item.stockQuantity} left!
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 font-medium mt-1">In Stock</p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isOutOfStock}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-50 rounded-l-lg"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stockQuantity || isOutOfStock}
                            className="p-1.5 hover:bg-gray-100 disabled:opacity-50 rounded-r-lg"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    </div>

                    {/* Remove Button */}
                    {isManaging && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ✅ SECTION 1: You Might Also Like */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">You might also like</h3>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Link key={i} href={`/products/mock-${i}`} className="bg-white rounded-lg border border-gray-200 overflow-hidden group">
                  <div className="aspect-square bg-gray-100 relative">
                     <div className="w-full h-full flex items-center justify-center text-gray-400">Product Img</div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-1">Recommended Product {i}</h4>
                    <p className="text-sm font-bold text-green-700 mt-1">GH₵ {(Math.random() * 100).toFixed(2)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ✅ SECTION 2: Saved for Later (Wishlist) */}
          {wishlistItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Saved for Later</h3>
                <Link href="/account/wishlist" className="text-sm text-green-600 font-medium">View All</Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {wishlistItems.slice(0, 4).map((item) => (
                  <Link key={item.id} href={`/products/${item.slug}`} className="bg-white rounded-lg border border-gray-200 overflow-hidden group">
                    <div className="aspect-square bg-gray-100 relative">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.title} fill className="object-cover" unoptimized />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center text-gray-400"><Heart className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</h4>
                      <p className="text-sm font-bold text-green-700 mt-1">{formatCurrency(item.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: ORDER SUMMARY */}
        <div className="hidden md:block">
          <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items ({selectedTotalItems})</span>
                <span className="font-medium">{formatCurrency(selectedTotalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Delivery</span>
                <span className="font-medium">{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(selectedTotalAmount + (selectedTotalItems > 0 ? deliveryFee : 0))}</span>
              </div>
            </div>

            <Link
              href={selectedTotalItems > 0 ? "/checkout" : "#"}
              className={`block w-full text-center font-semibold py-3.5 rounded-lg mt-6 transition-colors ${
                selectedTotalItems > 0 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Proceed to Checkout
            </Link>
            
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Delivery fees are estimated and will be finalized based on your shipping address at checkout.</p>
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE STICKY CHECKOUT BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">Total ({selectedTotalItems} items)</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(selectedTotalAmount + (selectedTotalItems > 0 ? deliveryFee : 0))}</p>
          </div>
          <Link
            href={selectedTotalItems > 0 ? "/checkout" : "#"}
            className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
              selectedTotalItems > 0 
                ? "bg-green-600 hover:bg-green-700 text-white" 
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            Checkout
          </Link>
        </div>
      </div>
   
    </div>
  );
}