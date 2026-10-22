 // src/app/cart/page.tsx
"use client";

import { useCartStore } from "@/store/cartStore";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal > 0 ? 20 : 0; // Example flat fee or calculate dynamically
  const total = subtotal + deliveryFee;

  const handleCheckout = () => {
    if (items.length === 0) return;

    setIsCheckingOut(true);

    // ✅ Check if user is logged in
    if (status === "unauthenticated") {
      // Redirect to login, but remember they wanted to go to checkout
      router.push("/login?callbackUrl=/checkout");
      return;
    }

    // If logged in, proceed to checkout page
    router.push("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
        <Link href="/products" className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-white min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart ({items.length})</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={`${item.productId}-${item.variantId}`} className="flex gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                )}
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.sellerName}</p>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                    >
                      -
                    </button>
                    <span className="font-medium w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-green-600">GH₵ {(item.price * item.quantity).toFixed(2)}</span>
                    <button 
                      onClick={() => removeItem(item.productId, item.variantId)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary & Checkout Button */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>GH₵ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>GH₵ {deliveryFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Total</span>
                <span>GH₵ {total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isCheckingOut || status === "loading"}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCheckingOut || status === "loading" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Proceed to Checkout
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              {status === "authenticated" 
                ? "You are logged in. Ready to pay!" 
                : "You will be asked to log in or sign up at checkout."}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}