 // src/components/DraggableFAB.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useState, useEffect } from "react";

export default function DraggableFAB() {
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const wishlistCount = useWishlistStore((state) => state.items.length);

  // ✅ FIX: Initialize with 0 to avoid "window is not defined" on server
  const [cartPos, setCartPos] = useState({ x: 0, y: 0 });
  const [wishPos, setWishPos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
    
    // Load from storage or use defaults based on current screen size
    const savedCart = localStorage.getItem("fab-cart-pos");
    const savedWish = localStorage.getItem("fab-wish-pos");
    
    const defaultCartX = window.innerWidth - 80;
    const defaultCartY = window.innerHeight - 150;
    const defaultWishX = window.innerWidth - 80;
    const defaultWishY = window.innerHeight - 230;

    if (savedCart) setCartPos(JSON.parse(savedCart));
    else setCartPos({ x: defaultCartX, y: defaultCartY });

    if (savedWish) setWishPos(JSON.parse(savedWish));
    else setWishPos({ x: defaultWishX, y: defaultWishY });
  }, []);

  const handleDrag = (e: React.TouchEvent | React.MouseEvent, setter: any, key: string) => {
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const currentPos = key.includes('cart') ? cartPos : wishPos;
    const offsetX = startX - currentPos.x;
    const offsetY = startY - currentPos.y;

    const moveHandler = (moveEvent: TouchEvent | MouseEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      let newX = clientX - offsetX;
      let newY = clientY - offsetY;

      // Boundary checks
      const maxX = window.innerWidth - 64;
      const maxY = window.innerHeight - 64;
      
      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      setter({ x: newX, y: newY });
    };

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', upHandler);
      
      // Save final position
      localStorage.setItem(key, JSON.stringify(currentPos)); 
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', upHandler);
  };

  // ✅ FIX: Don't render anything until mounted to prevent hydration mismatch
  if (!mounted || !isMobile) return null;

  return (
    <>
      {/* Draggable Wishlist */}
      <Link 
        href="/account/wishlist"
        className="fixed z-40 w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-700 hover:text-rose-500 transition-transform active:scale-95 border border-gray-100"
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
        className="fixed z-50 w-16 h-16 bg-green-600 rounded-full shadow-2xl shadow-green-600/40 flex items-center justify-center text-white hover:bg-green-700 transition-transform active:scale-95"
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
    </>
  );
}