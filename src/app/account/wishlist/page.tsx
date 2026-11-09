"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useWishlistStore, WishlistItem } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";

export default function WishlistPage() {
  const { status } = useSession();

  const {
    items,
    isLoading,
    fetchWishlist,
    removeItem,
    clearWishlist,
  } = useWishlistStore();

  const { addItem: addCartItem } = useCartStore();

  const [isMounted, setIsMounted] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchWishlist();
    }
  }, [status, fetchWishlist]);

  const formatCurrency = (amount: number) =>
    `GH ${Number(amount || 0).toFixed(2)}`;

  const handleRemove = async (id: string) => {
    await removeItem(id);
  };

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear your wishlist?")) {
      return;
    }

    await clearWishlist();
  };

  const handleMoveToCart = async (item: WishlistItem) => {
    if (
      !item.variantId ||
      !item.offerId ||
      !item.sellerId ||
      !item.stockQuantity ||
      item.stockQuantity < 1
    ) {
      setNotice(
        `${item.title} cannot be added right now. View the product to check available sellers and stock.`
      );
      return;
    }

    setAddingId(item.id);
    setNotice("");

    try {
      const success = await addCartItem({
        productId: item.id,
        variantId: item.variantId,
        offerId: item.offerId,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        title: item.title,
        price: item.price,
        imageUrl: item.imageUrl,
        slug: item.slug,
        stockQuantity: item.stockQuantity,
        quantity: 1,
      });

      if (success) {
        await removeItem(item.id);
        setNotice(`${item.title} was added to your cart.`);
      } else {
        setNotice("Could not add this item to your cart. Please try again.");
      }
    } finally {
      setAddingId(null);
    }
  };

  if (!isMounted || status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <AccountSubPageLayout title="My Wishlist">
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      </AccountSubPageLayout>
    );
  }

  return (
    <AccountSubPageLayout title="My Wishlist">
      <div className="mx-auto max-w-5xl px-4 py-5 pb-24">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Saved products
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {items.length} {items.length === 1 ? "item" : "items"} saved
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClear()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
          )}
        </div>

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
          >
            {notice}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <Heart className="h-8 w-8 text-rose-500" />
            </div>

            <h2 className="text-lg font-semibold text-gray-900">
              Your wishlist is empty
            </h2>

            <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-gray-500">
              Save products you love and find them here whenever you need them.
            </p>

            <Link
              href="/categories"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <ShoppingBag className="h-4 w-4" />
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((item) => {
              const canMoveToCart = Boolean(
                item.variantId &&
                item.offerId &&
                item.sellerId &&
                item.stockQuantity &&
                item.stockQuantity > 0
              );

              return (
                <article
                  key={item.id}
                  className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <button
                    type="button"
                    aria-label={`Remove ${item.title} from wishlist`}
                    onClick={() => void handleRemove(item.id)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-white/95 p-2 text-gray-600 shadow-sm transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <Link
                    href={`/products/${item.slug}`}
                    className="block"
                  >
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-9 w-9 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <h3 className="line-clamp-2 min-h-10 text-sm font-medium text-gray-900">
                        {item.title}
                      </h3>

                      <p className="mt-1 truncate text-xs text-gray-500">
                        {item.sellerName}
                      </p>

                      <p className="mt-2 text-sm font-bold text-green-700">
                        {formatCurrency(item.price)}
                      </p>

                      {item.stockQuantity !== undefined && (
                        <p
                          className={`mt-1 text-xs ${
                            item.stockQuantity > 0
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {item.stockQuantity > 0
                            ? "In stock"
                            : "Currently unavailable"}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="mt-auto space-y-2 px-3 pb-3">
                    <button
                      type="button"
                      disabled={addingId === item.id || !canMoveToCart}
                      onClick={() => void handleMoveToCart(item)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-2 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {addingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      {addingId === item.id
                        ? "Adding..."
                        : canMoveToCart
                          ? "Move to cart"
                          : "Check availability"}
                    </button>

                    <Link
                      href={`/products/${item.slug}`}
                      className="block w-full rounded-lg border border-gray-200 py-2 text-center text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      View product
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AccountSubPageLayout>
  );
}
