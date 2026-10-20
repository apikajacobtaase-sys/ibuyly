// src/components/QuantitySelector.tsx
"use client";

import { Minus, Plus, Loader2 } from "lucide-react";

interface QuantitySelectorProps {
  quantity: number;
  maxQuantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  isUpdating?: boolean;
  size?: "sm" | "md";
}

export default function QuantitySelector({
  quantity,
  maxQuantity,
  onIncrease,
  onDecrease,
  isUpdating = false,
  size = "md",
}: QuantitySelectorProps) {
  const isSm = size === "sm";

  return (
    <div className={`flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden ${isSm ? "h-8" : "h-10"}`}>
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1 || isUpdating}
        className={`flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          isSm ? "w-8" : "w-10"
        }`}
        aria-label="Decrease quantity"
      >
        {isUpdating && quantity <= 1 ? (
          <Loader2 className={`${isSm ? "w-3 h-3" : "w-4 h-4"} animate-spin`} />
        ) : (
          <Minus className={isSm ? "w-3 h-3" : "w-4 h-4"} />
        )}
      </button>
      
      <span className={`flex-1 text-center font-semibold text-gray-900 select-none ${isSm ? "text-xs" : "text-sm"}`}>
        {quantity}
      </span>
      
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= maxQuantity || isUpdating}
        className={`flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          isSm ? "w-8" : "w-10"
        }`}
        aria-label="Increase quantity"
        title={quantity >= maxQuantity ? "Maximum available stock reached" : ""}
      >
        {isUpdating && quantity >= maxQuantity ? (
          <Loader2 className={`${isSm ? "w-3 h-3" : "w-4 h-4"} animate-spin`} />
        ) : (
          <Plus className={isSm ? "w-3 h-3" : "w-4 h-4"} />
        )}
      </button>
    </div>
  );
}