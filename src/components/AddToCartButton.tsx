// src/components/AddToCartButton.tsx
"use client";

import { useState } from "react";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

interface AddToCartButtonProps {
  product: {
    id: string;
    title: string;
    slug?: string;
    images: { url: string }[];
  };
  bestOfferId?: string | null;
  bestVariantId?: string | null;
  price: number;
  stock: number;
  sellerId?: string | null;
  sellerName?: string | null;
  className?: string;
}

export default function AddToCartButton({
  product,
  bestOfferId,
  bestVariantId,
  price,
  stock,
  sellerId,
  sellerName,
  className = "",
}: AddToCartButtonProps) {
  const [status, setStatus] = useState<"idle" | "adding" | "success">("idle");
  const addItem = useCartStore((state) => state.addItem);

  const availableStock = Number.isFinite(stock)
    ? Math.max(0, Math.floor(stock))
    : 0;

  const handleAddToCart = async () => {
    if (!bestVariantId || !bestOfferId || !sellerId) {
      alert(
        "Product information is incomplete. Please refresh the page and try again."
      );
      return;
    }

    if (availableStock < 1) {
      alert("Sorry, this item is currently out of stock.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      alert("This product has an invalid price. Please try again later.");
      return;
    }

    setStatus("adding");

    try {
      await addItem({
        productId: product.id,
        variantId: bestVariantId,
        offerId: bestOfferId,
        title: product.title,
        price,
        quantity: 1,
        imageUrl: product.images[0]?.url ?? undefined,
        slug: product.slug,
        stockQuantity: availableStock,
        sellerId,
        sellerName: sellerName?.trim() || "Seller",
      });

      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to add item to cart:", error);
      setStatus("idle");
      alert("Failed to add item to your cart. Please try again.");
    }
  };

  const isDisabled =
    status !== "idle" ||
    availableStock < 1 ||
    !bestOfferId ||
    !bestVariantId ||
    !sellerId;

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isDisabled}
      aria-label={
        availableStock < 1 ? "Product out of stock" : "Add product to cart"
      }
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
      ) : availableStock < 1 ? (
        <>
          <ShoppingCart className="w-5 h-5" />
          Out of Stock
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
