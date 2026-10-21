 // src/components/DraggableFAB.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useState, useEffect, useRef } from "react";

export default function DraggableFAB() {
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const wishlistCount = useWishlistStore((state) => state.items.length);

  // Positions (default to bottom right)
  const [cartPos, setCartPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 150 });
  const [wishPos, setWishPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 220 });

  // Load saved positions
  useEffect(() => {
    const savedCart = localStorage.getItem("fab-cart-pos");
    const savedWish = localStorage.getItem("fab-wish-pos");
    if (savedCart) setCartPos(JSON.parse(savedCart));
    if (savedWish) setWishPos(JSON.parse(savedWish));
  }, []);

  const handleDrag = (e: React.TouchEvent | React.MouseEvent, setter: any, key: string) => {
    const target = e.currentTarget as HTMLElement;
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = target.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    const moveHandler = (moveEvent: TouchEvent | MouseEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      let newX = clientX - offsetX;
      let newY = clientY - offsetY;

      // Boundary checks
      newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
      newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

      setter({ x: newX, y: newY });
    };

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', upHandler);
      
      // Save position
      localStorage.setItem(key, JSON.stringify({ x: cartPos.x, y: cartPos.y })); // Note: Use current state or ref for accuracy
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', upHandler);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 md:hidden">
      
      {/* Draggable Wishlist */}
      <Link 
        href="/account/wishlist"
        className="pointer-events-auto absolute w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-700 hover:text-rose-500 transition-transform active:scale-95"
        style={{ left: wishPos.x, top: wishPos.y }}
        onTouchStart={(e) => handleDrag(e, setWishPos, "fab-wish-pos")}
        onMouseDown={(e) => handleDrag(e, setWishPos, "fab-wish-pos")}
      >
        <Heart className={`w-6 h-6 ${wishlistCount > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
        {wishlistCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {wishlistCount}
          </span>
        )}
      </Link>

      {/* Draggable Cart */}
      <Link 
        href="/cart"
        className="pointer-events-auto absolute w-16 h-16 bg-green-600 rounded-full shadow-2xl shadow-green-600/40 flex items-center justify-center text-white hover:bg-green-700 transition-transform active:scale-95"
        style={{ left: cartPos.x, top: cartPos.y }}
        onTouchStart={(e) => handleDrag(e, setCartPos, "fab-cart-pos")}
        onMouseDown={(e) => handleDrag(e, setCartPos, "fab-cart-pos")}
      >
        <ShoppingCart className="w-7 h-7" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-6 px-1 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}