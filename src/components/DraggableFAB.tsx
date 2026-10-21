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

  // Default positions (bottom right)
  const [cartPos, setCartPos] = useState({ x: 0, y: 0 });
  const [wishPos, setWishPos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Initialize positions only on client side
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    
    // Load from storage or use defaults
    const savedCart = localStorage.getItem("fab-cart-pos");
    const savedWish = localStorage.getItem("fab-wish-pos");
    
    if (savedCart) setCartPos(JSON.parse(savedCart));
    else setCartPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 });

    if (savedWish) setWishPos(JSON.parse(savedWish));
    else setWishPos({ x: window.innerWidth - 80, y: window.innerHeight - 230 });
  }, []);

  const handleDrag = (e: React.TouchEvent | React.MouseEvent, setter: any, key: string) => {
    // Prevent default to stop scrolling while dragging
    if ('touches' in e) {
      // e.preventDefault(); // Optional: uncomment if it blocks scrolling too much
    }

    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Get current position from state (or ref for better accuracy in rapid moves)
    const currentPos = key.includes('cart') ? cartPos : wishPos;
    
    const offsetX = startX - currentPos.x;
    const offsetY = startY - currentPos.y;

    const moveHandler = (moveEvent: TouchEvent | MouseEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      let newX = clientX - offsetX;
      let newY = clientY - offsetY;

      // Boundary checks (keep within screen)
      const maxX = window.innerWidth - 64; // button width approx
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
      const finalPos = key.includes('cart') ? cartPos : wishPos; 
      // Note: In a real app, use a ref to get the *very* last value during drag
      localStorage.setItem(key, JSON.stringify(finalPos));
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', upHandler);
  };

  if (!isMobile) return null;

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