// src/components/CheckoutEntry.tsx
"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { ShoppingCart, Lock, ArrowRight, Package } from "lucide-react";

export default function CheckoutEntry() {
  const cartItems = useCartStore((state) => state.items);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            You're one step away from your order
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Log in or create an account to save your delivery address and complete your purchase.
          </p>
        </div>

        {/* Cart Summary */}
        {cartItems.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">
                Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
              </h2>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cartItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
              {cartItems.length > 3 && (
                <p className="text-sm text-gray-500 text-center pt-2 border-t">
                  +{cartItems.length - 3} more item{cartItems.length - 3 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/login?callbackUrl=/checkout"
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
          >
            Log In to Continue
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/register?callbackUrl=/checkout"
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-indigo-600 font-semibold rounded-xl border-2 border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Create New Account
          </Link>

          <Link
            href="/cart"
            className="w-full flex items-center justify-center px-6 py-3 text-gray-600 font-medium hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
          >
            ← Back to Cart
          </Link>
        </div>

        {/* Trust Signals */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-semibold text-gray-900 mb-1">Secure Checkout</p>
              <p className="text-xs text-gray-500">Your data is encrypted</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 mb-1">Fast Delivery</p>
              <p className="text-xs text-gray-500">Track your order</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 mb-1">Easy Returns</p>
              <p className="text-xs text-gray-500">Hassle-free policy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}