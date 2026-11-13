 "use client";

import { useCompareStore } from "@/store/compareStore";
import { X, GitCompare, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
export default function CompareBar() {
  const { items, removeItem, clearCompare } = useCompareStore();
 const pathname = usePathname();
  if (items.length === 0) return null;
  if (pathname === "/compare") return null;
  return (
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-[60] border-t-2 border-ibuy-orange bg-white shadow-2xl">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5">

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-ibuy-orange" />

            <span className="text-sm font-bold text-gray-900">
              Compare Products ({items.length}/4)
            </span>
          </div>

          <button
            onClick={clearCompare}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex min-w-[150px] max-w-[170px] flex-shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
            >
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-white">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <GitCompare className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pr-3">
                <p className="line-clamp-2 text-xs font-semibold text-gray-800">
                  {item.title}
                </p>

                <p className="mt-1 text-xs font-bold text-green-700">
                  GH₵ {item.price.toFixed(2)}
                </p>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.title} from comparison`}
                title="Remove product"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">
            Select at least 2 products to compare.
          </p>

          {items.length >= 2 ? (
            <Link
              href="/compare"
              className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-ibuy-orange px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ibuy-orange-hover"
            >
              <GitCompare className="h-4 w-4" />
              Compare Now
            </Link>
          ) : (
            <button
              disabled
              className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-gray-300 px-5 py-2.5 text-sm font-bold text-white"
            >
              <GitCompare className="h-4 w-4" />
              Compare Now
            </button>
          )}
        </div>

      </div>
    </div>
  );
}