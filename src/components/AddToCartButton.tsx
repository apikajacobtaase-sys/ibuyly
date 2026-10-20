// src/components/AddToCartButton.tsx
"use client";

import { useState } from "react";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  slug?: string;
  stockQuantity?: number;
  className?: string;
}

export default function AddToCartButton({ 
  productId, 
  variantId, 
  title, 
  price,
  imageUrl,
  slug,
  stockQuantity,
  className = ""
}: AddToCartButtonProps) {
  const [status, setStatus] = useState<"idle" | "adding" | "success">("idle");
  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = async () => {
    if (!variantId) {
      alert("Please select a product option/variant first.");
      return;
    }

    if (stockQuantity !== undefined && stockQuantity < 1) {
      alert("Sorry, this item is currently out of stock.");
      return;
    }

    setStatus("adding");
    
    try {
      // Add to Zustand store (which automatically syncs to DB in the background)
      addItem({
        productId,
        variantId,
        title,
        price,
        quantity: 1,
        imageUrl: imageUrl || undefined,
        slug: slug || undefined,
        stockQuantity,
      });

      setStatus("success");
      
      // Reset back to idle after 2 seconds
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      setStatus("idle");
      alert("Failed to add item. Please try again.");
    }
  };

  const isDisabled = status === "adding" || status === "success" || (stockQuantity !== undefined && stockQuantity < 1);

  return (
    <button
      onClick={handleAddToCart}
      disabled={isDisabled}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
        status === "success"
          ? "bg-green-500 text-white"
          : "bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      } ${className}`}
    >
      {status === "adding" ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Adding...
        </>
      ) : status === "success" ? (
        <>
          <Check className="w-5 h-5" />
          Added to Cart!
        </>
      ) : (
        <>
          <ShoppingCart className="w-5 h-5" />
          Add to Cart
        </>
      )}
    </button>
  );
}