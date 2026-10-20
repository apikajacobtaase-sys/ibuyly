"use client";

import { useCompareStore } from "@/store/compareStore";
import { X, GitCompare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function CompareBar() {
  const { items, removeItem, clearCompare } = useCompareStore();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t-2 border-ibuy-orange shadow-2xl z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-x-auto flex-1">
            <GitCompare className="w-6 h-6 text-ibuy-orange flex-shrink-0" />
            <span className="text-sm font-semibold text-ibuy-text whitespace-nowrap">
              Compare ({items.length}/4):
            </span>
            <div className="flex items-center gap-2">
              {items.map((item) => (
                <div key={item.id} className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg border-2 border-ibuy-orange overflow-hidden bg-gray-100">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.title} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">📦</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearCompare}
              className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition whitespace-nowrap"
            >
              Clear
            </button>
            <Link
              href="/compare"
              className="px-6 py-2 bg-ibuy-orange text-white rounded-lg font-semibold hover:bg-ibuy-orange-hover transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Compare Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}