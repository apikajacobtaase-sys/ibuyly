// src/components/PromoCodeInput.tsx
"use client";

import { useState } from "react";
import { Tag, Loader2, CheckCircle, XCircle, X } from "lucide-react";

interface PromoCodeInputProps {
  subtotal: number;
  onDiscountApplied: (discountAmount: number, code: string) => void;
  onDiscountRemoved: () => void;
  currentDiscount?: { code: string; amount: number } | null;
}

export default function PromoCodeInput({
  subtotal,
  onDiscountApplied,
  onDiscountRemoved,
  currentDiscount,
}: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsApplying(true);
    setError("");

    try {
      const res = await fetch("/api/checkout/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          orderTotal: subtotal,
        }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        onDiscountApplied(data.discountAmount, data.code);
        setCode(""); // Clear input on success
      } else {
        setError(data.error || "Invalid discount code");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  // If a discount is already applied, show the success state
  if (currentDiscount) {
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              {currentDiscount.code} Applied
            </p>
            <p className="text-xs text-emerald-700">
              You saved GH₵ {currentDiscount.amount.toFixed(2)}
            </p>
          </div>
        </div>
        <button
          onClick={onDiscountRemoved}
          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-full transition-colors"
          title="Remove discount"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Otherwise, show the input form
  return (
    <form onSubmit={handleApply} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            placeholder="Promo code"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isApplying}
          />
        </div>
        <button
          type="submit"
          disabled={isApplying || !code.trim()}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isApplying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </button>
      </div>
      
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </form>
  );
}