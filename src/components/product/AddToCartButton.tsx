 // src/components/product/AddToCartButton.tsx
"use client";

import { useState } from "react";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";

interface Props {
  product: {
    id: string;
    title: string;
    slug: string;
    images: { url: string }[];
  };
  bestOfferId?: string;
  bestVariantId?: string;
  price: number;
  stock: number;
  sellerId?: string;   // ✅ Added
  sellerName?: string; // ✅ Added
}

export default function AddToCartButton({ 
  product, 
  bestOfferId, 
  bestVariantId, 
  price, 
  stock,
  sellerId,
  sellerName 
}: Props) {
  const { addItem } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    if (!bestOfferId || !bestVariantId) return;
    
    setIsLoading(true);
    
    // Fly animation logic
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    triggerFlyToCart({
      imageUrl: product.images[0]?.url || "",
      startX: rect.left + rect.width / 2,
      startY: rect.top,
      id: Date.now().toString(),
    });

    addItem({
      productId: product.id,
      variantId: bestVariantId,
      offerId: bestOfferId,
      title: product.title,
      price: price,
      imageUrl: product.images[0]?.url,
      stockQuantity: stock,
      sellerId: sellerId || "unknown",   // ✅ Use prop directly
      sellerName: sellerName || "iBUY",  // ✅ Use prop directly
      quantity: 1,
    });

    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <button
      onClick={handleAdd}
      disabled={stock === 0 || isLoading}
      className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg ${
        stock > 0 
          ? "bg-green-600 hover:bg-green-700 text-white hover:shadow-green-600/20" 
          : "bg-gray-200 text-gray-500 cursor-not-allowed"
      }`}
    >
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <>
          <ShoppingCart className="w-6 h-6" />
          {stock > 0 ? "Add to Cart" : "Out of Stock"}
        </>
      )}
    </button>
  );
}