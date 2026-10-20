"use client";

import { useState } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

interface ProductBuyBoxProps {
  productId: string;
  title: string;
  variants: Array<{
    id: string;
    price: number | string;
    stockQuantity: number;
    attributes?: any;
  }>;
  sellerName: string;
}

export default function ProductBuyBox({ productId, title, variants, sellerName }: ProductBuyBoxProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const variant = variants[selectedVariantIndex] || variants[0];
  const price = typeof variant.price === "string" ? parseFloat(variant.price) : variant.price;
  const stock = variant.stockQuantity;

  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = () => {
    if (stock <= 0) return;
    addItem({
      productId,
      title,
      price,
      quantity,
      sellerName,
    });
    alert(`✅ Added ${quantity}x "${title}" to cart!`);
  };

  return (
    <div className="bg-ibuy-card border border-ibuy-border rounded-xl p-4 md:p-6 sticky top-24">
      <div className="mb-4">
        <p className="text-sm text-ibuy-text-secondary mb-1">Price</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold text-ibuy-orange">GH₵ {price.toFixed(2)}</span>
          {stock > 0 ? (
            <span className="text-sm text-ibuy-success font-medium">In Stock ({stock} available)</span>
          ) : (
            <span className="text-sm text-ibuy-error font-medium">Out of Stock</span>
          )}
        </div>
      </div>

      {/* Variant Selector */}
      {variants.length > 1 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-ibuy-text mb-2">Options</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVariantIndex(idx);
                  setQuantity(1); // Reset quantity on variant change
                }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                  selectedVariantIndex === idx
                    ? "border-ibuy-orange bg-ibuy-orange/10 text-ibuy-orange"
                    : "border-ibuy-border text-ibuy-text hover:border-ibuy-orange"
                }`}
              >
                {v.attributes ? Object.values(v.attributes).join(" / ") : `Option ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-ibuy-text mb-2">Quantity</p>
        <div className="flex items-center border border-ibuy-border rounded-lg w-fit">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-4 py-2 text-ibuy-text hover:bg-ibuy-bg transition disabled:opacity-50"
            disabled={quantity <= 1}
          >
            -
          </button>
          <span className="px-4 py-2 font-medium text-ibuy-text border-x border-ibuy-border min-w-[3rem] text-center">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(Math.min(stock, quantity + 1))}
            className="px-4 py-2 text-ibuy-text hover:bg-ibuy-bg transition disabled:opacity-50"
            disabled={quantity >= stock || stock <= 0}
          >
            +
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handleAddToCart}
          disabled={stock <= 0}
          className="w-full flex items-center justify-center gap-2 bg-ibuy-orange text-white py-3.5 rounded-lg font-bold text-lg hover:bg-ibuy-orange-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-5 h-5" />
          Add to Cart
        </button>
        <button
          disabled={stock <= 0}
          className="w-full flex items-center justify-center gap-2 bg-ibuy-intelligence text-white py-3.5 rounded-lg font-bold text-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-5 h-5" />
          Buy Now
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-ibuy-border">
        <p className="text-sm text-ibuy-text-secondary mb-1">Sold by</p>
        <p className="font-semibold text-ibuy-text">{sellerName}</p>
      </div>
    </div>
  );
}