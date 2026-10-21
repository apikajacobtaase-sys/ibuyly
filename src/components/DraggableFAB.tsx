 "use client";

import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type Position = {
x: number;
y: number;
};

export default function DraggableFAB() {
const pathname = usePathname();

const cartCount = useCartStore((state) =>
state.items.reduce((sum, item) => sum + item.quantity, 0)
);

const wishlistCount = useWishlistStore(
(state) => state.items.length
);

const [cartPos, setCartPos] = useState<Position>({
x: 0,
y: 0,
});

const [wishPos, setWishPos] = useState<Position>({
x: 0,
y: 0,
});

const [isMobile, setIsMobile] = useState(false);
const [mounted, setMounted] = useState(false);

// All Hooks execute on every render, regardless of the current route.
useEffect(() => {
setMounted(true);


const updateMobileStatus = () => {
  setIsMobile(window.innerWidth < 768);
};

updateMobileStatus();

window.addEventListener("resize", updateMobileStatus);

try {
  const savedCart = localStorage.getItem("fab-cart-pos");
  const savedWish = localStorage.getItem("fab-wish-pos");

  const defaultCart: Position = {
    x: Math.max(0, window.innerWidth - 80),
    y: Math.max(0, window.innerHeight - 150),
  };

  const defaultWish: Position = {
    x: Math.max(0, window.innerWidth - 80),
    y: Math.max(0, window.innerHeight - 230),
  };

  const parsePosition = (
    value: string | null,
    fallback: Position
  ): Position => {
    if (!value) return fallback;

    try {
      const parsed: unknown = JSON.parse(value);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "x" in parsed &&
        "y" in parsed &&
        typeof parsed.x === "number" &&
        typeof parsed.y === "number" &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y)
      ) {
        return {
          x: Math.max(
            0,
            Math.min(window.innerWidth - 64, parsed.x)
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - 64, parsed.y)
          ),
        };
      }
    } catch {
      // Invalid saved data: use the default position.
    }

    return fallback;
  };

  setCartPos(parsePosition(savedCart, defaultCart));
  setWishPos(parsePosition(savedWish, defaultWish));
} catch (error) {
  console.error("Failed to restore FAB positions:", error);
}

return () => {
  window.removeEventListener("resize", updateMobileStatus);
};

}, []);

const handleDrag = (
e: React.TouchEvent<HTMLAnchorElement> | React.MouseEvent<HTMLAnchorElement>,
setter: React.Dispatch<React.SetStateAction<Position>>,
key: string,
currentPos: Position
) => {
// Prevent the link from initiating a drag on touch devices.
if ("touches" in e) {
e.preventDefault();
}
const startX =
  "touches" in e
    ? e.touches[0].clientX
    : e.clientX;

const startY =
  "touches" in e
    ? e.touches[0].clientY
    : e.clientY;

const offsetX = startX - currentPos.x;
const offsetY = startY - currentPos.y;

let finalPosition = currentPos;

const moveHandler = (moveEvent: TouchEvent | MouseEvent) => {
  if ("touches" in moveEvent) {
    if (moveEvent.cancelable) {
      moveEvent.preventDefault();
    }

    if (moveEvent.touches.length === 0) return;
  }

  const clientX =
    "touches" in moveEvent
      ? moveEvent.touches[0].clientX
      : moveEvent.clientX;

  const clientY =
    "touches" in moveEvent
      ? moveEvent.touches[0].clientY
      : moveEvent.clientY;

  const newPosition: Position = {
    x: Math.max(
      0,
      Math.min(window.innerWidth - 64, clientX - offsetX)
    ),
    y: Math.max(
      0,
      Math.min(window.innerHeight - 64, clientY - offsetY)
    ),
  };

  finalPosition = newPosition;
  setter(newPosition);
};

const cleanup = () => {
  document.removeEventListener("mousemove", moveHandler);
  document.removeEventListener("mouseup", cleanup);
  document.removeEventListener("touchmove", moveHandler);
  document.removeEventListener("touchend", cleanup);
  document.removeEventListener("touchcancel", cleanup);

  try {
    localStorage.setItem(key, JSON.stringify(finalPosition));
  } catch (error) {
    console.error("Failed to save FAB position:", error);
  }
};

document.addEventListener("mousemove", moveHandler);
document.addEventListener("mouseup", cleanup);
document.addEventListener("touchmove", moveHandler, {
  passive: false,
});
document.addEventListener("touchend", cleanup);
document.addEventListener("touchcancel", cleanup);
};


if (!mounted || !isMobile) {
  return null;
}

if (
  pathname === "/cart" ||
  pathname === "/account/wishlist"
) {
  return null;
}


return (
<>
{/* Draggable Wishlist */}
<Link
href="/account/wishlist"
className="fixed z-40 w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-700 hover:text-rose-500 transition-transform active:scale-95 border border-gray-100"
style={{
left: wishPos.x,
top: wishPos.y,
touchAction: "none",
}}
onTouchStart={(e) =>
handleDrag(e, setWishPos, "fab-wish-pos", wishPos)
}
onMouseDown={(e) =>
handleDrag(e, setWishPos, "fab-wish-pos", wishPos)
}
>
<Heart
className={`w-6 h-6 ${
            wishlistCount > 0
              ? "fill-rose-500 text-rose-500"
              : ""
          }`}
/>
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
    style={{
      left: cartPos.x,
      top: cartPos.y,
      touchAction: "none",
    }}
    onTouchStart={(e) =>
      handleDrag(e, setCartPos, "fab-cart-pos", cartPos)
    }
    onMouseDown={(e) =>
      handleDrag(e, setCartPos, "fab-cart-pos", cartPos)
    }
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
