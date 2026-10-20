// src/components/FloatingCart.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

// --- Configuration ---
const WIDGET_SIZE = 64; // px
const MARGIN = 16; // px from viewport edges
const DRAG_THRESHOLD = 5; // px before we consider it a drag (not a tap)
const SNAP_DURATION = 300; // ms for snap animation
const STORAGE_KEY = "ibuy-floating-cart-pos";

interface Position {
  x: number;
  y: number;
}

// --- Helpers ---
const getDefaultPosition = (): Position => {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - WIDGET_SIZE - MARGIN,
    y: window.innerHeight - WIDGET_SIZE - 100, // above bottom nav
  };
};

const clampPosition = (pos: Position): Position => {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - WIDGET_SIZE - MARGIN;
  const maxY = window.innerHeight - WIDGET_SIZE - MARGIN - 80; // above bottom nav
  return {
    x: Math.max(MARGIN, Math.min(pos.x, maxX)),
    y: Math.max(MARGIN + 60, Math.min(pos.y, maxY)), // below header
  };
};

const loadPosition = (): Position => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return clampPosition(parsed);
      }
    }
  } catch {
    // ignore corrupt data
  }
  return getDefaultPosition();
};

const snapToEdge = (pos: Position): Position => {
  const centerX = pos.x + WIDGET_SIZE / 2;
  const screenCenter = window.innerWidth / 2;
  const snappedX =
    centerX < screenCenter ? MARGIN : window.innerWidth - WIDGET_SIZE - MARGIN;
  return clampPosition({ x: snappedX, y: pos.y });
};

// Pages where the floating cart should be hidden (redundant or inappropriate)
const HIDDEN_PATH_PREFIXES = [
  "/cart",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/account",
  "/seller",
  "/admin",
];

export default function FloatingCart() {
  const router = useRouter();
  const pathname = usePathname();

  // Subscribe only to what we need to avoid unnecessary re-renders
  const totalItems = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0)
  );

  const [position, setPosition] = useState<Position>(() => loadPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const dragStartRef = useRef<Position | null>(null);
  const pointerStartRef = useRef<Position | null>(null);

  // --- Hide on certain pages ---
  const shouldHide = HIDDEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  // --- Handle viewport resize / orientation change ---
  useEffect(() => {
    const handleResize = () => setPosition((prev) => clampPosition(prev));
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // --- Pointer handlers (unified touch + mouse) ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      // Capture the pointer so we keep receiving move/up events even if cursor leaves the widget
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      dragStartRef.current = position;
      setIsDragging(true);
      setHasDragged(false);
    },
    [position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current || !pointerStartRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        setHasDragged(true);
      }

      setPosition(
        clampPosition({
          x: dragStartRef.current.x + dx,
          y: dragStartRef.current.y + dy,
        })
      );
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);

      // Snap to nearest edge after a real drag
      if (hasDragged) {
        setIsSnapping(true);
        const snapped = snapToEdge(position);
        setPosition(snapped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped));
        } catch {
          // ignore quota errors
        }
        setTimeout(() => setIsSnapping(false), SNAP_DURATION);
      }
    },
    [isDragging, hasDragged, position]
  );

  // --- Tap to navigate (only if not a drag) ---
  const handleClick = useCallback(() => {
    if (!hasDragged) {
      router.push("/cart");
    }
  }, [hasDragged, router]);

  // --- Render ---
  if (shouldHide || totalItems === 0) return null;

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label={`Open shopping cart, ${totalItems} ${
        totalItems === 1 ? "item" : "items"
      }`}
      className={`fixed z-[60] flex flex-col items-center justify-center bg-white border-2 border-green-600 rounded-full shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
        isDragging ? "cursor-grabbing scale-105 shadow-xl" : "cursor-grab"
      } ${isSnapping ? "transition-all duration-300 ease-out" : ""}`}
      style={{
        width: `${WIDGET_SIZE}px`,
        height: `${WIDGET_SIZE}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: "none",
        WebkitUserSelect: isDragging ? "none" : "auto",
        userSelect: isDragging ? "none" : "auto",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <ShoppingCart
        className="w-6 h-6 text-green-600"
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <span className="text-[9px] font-bold text-green-700 leading-none mt-0.5">
        Cart
      </span>

      {/* Live item-count badge */}
      {totalItems > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white"
          aria-hidden="true"
        >
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  );
}