 // src/components/FloatingDock.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, Heart, Menu, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

interface FloatingDockProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export default function FloatingDock({ onMenuToggle, isMenuOpen }: FloatingDockProps) {
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const wishlistCount = useWishlistStore((state) => state.items.length);

  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3 md:hidden">
      
      {/* 1. Menu Button (Bottom) */}
      <button
        onClick={onMenuToggle}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 ${
          isMenuOpen ? "bg-gray-900 text-white rotate-90" : "bg-white text-gray-700"
        }`}
      >
        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* 2. Wishlist Button (Middle) - The "Flower" */}
      <Link
        href="/account/wishlist"
        className="relative w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-rose-500 transition-all duration-300 transform hover:scale-110 active:scale-95 group"
      >
        <Heart className={`w-6 h-6 transition-colors ${wishlistCount > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
        {wishlistCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {wishlistCount > 9 ? "9+" : wishlistCount}
          </span>
        )}
      </Link>

      {/* 3. Cart Button (Top) - The Primary Action */}
      <Link
        href="/cart"
        className="relative w-16 h-16 bg-green-600 rounded-full shadow-xl shadow-green-600/30 flex items-center justify-center text-white transition-all duration-300 transform hover:scale-110 active:scale-95 hover:bg-green-700"
      >
        <ShoppingCart className="w-7 h-7" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-6 px-1 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {cartCount > 9 ? "9+" : cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}