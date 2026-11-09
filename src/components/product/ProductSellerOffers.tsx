"use client";

import { useState } from "react";
import Image from "next/image";
import { Store, ShoppingCart, Check } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import QuantitySelector from "@/components/QuantitySelector";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";

interface SellerOffer {
  offerId: string;
  sellerId: string;
  sellerName: string;
  sellerLogoUrl: string | null;
  price: number;
  stockQuantity: number;
}

interface ProductVariant {
  id: string;
  label: string;
  offers: SellerOffer[];
}

interface ProductSellerOffersProps {
  productId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  variants: ProductVariant[];
}

export default function ProductSellerOffers({
  productId,
  title,
  slug,
  imageUrl,
  variants,
}: ProductSellerOffersProps) {
  const { addItem, updateQuantity, removeItem, items } = useCartStore();

  const [selectedVariantId, setSelectedVariantId] = useState(
    variants[0]?.id ?? ""
  );
  const [addingOfferId, setAddingOfferId] = useState<string | null>(null);

  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId
  );

  const handleAddToCart = async (offer: SellerOffer) => {
    if (!selectedVariant || offer.stockQuantity < 1) return;

    setAddingOfferId(offer.offerId);

    try {
      const imageElement = document.querySelector(".main-product-image");

      if (imageElement && imageUrl) {
        const rect = getElementRect(imageElement as HTMLElement);

        triggerFlyToCart({
          imageUrl,
          startX: rect.x,
          startY: rect.y,
          id: Date.now().toString(),
        });
      }

      await addItem({
        productId,
        variantId: selectedVariant.id,
        offerId: offer.offerId,
        title,
        price: offer.price,
        imageUrl,
        slug,
        stockQuantity: offer.stockQuantity,
        sellerId: offer.sellerId,
        sellerName: offer.sellerName,
        quantity: 1,
      });
    } finally {
      setAddingOfferId(null);
    }
  };

  if (variants.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-100 pt-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">
          Compare sellers
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a seller based on price and available stock.
        </p>
      </div>

      {variants.length > 1 && (
        <div className="mb-6">
          <label
            htmlFor="seller-product-variant"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Select product option
          </label>

          <select
            id="seller-product-variant"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedVariant && selectedVariant.offers.length > 0 ? (
        <div className="space-y-3">
          {selectedVariant.offers.map((offer) => {
            const cartItem = items.find(
              (item) =>
                item.productId === productId &&
                item.variantId === selectedVariant.id &&
                item.offerId === offer.offerId
            );

            const cartQuantity = cartItem?.quantity ?? 0;
            const isAdding = addingOfferId === offer.offerId;

            return (
              <div
                key={offer.offerId}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-green-50">
                    {offer.sellerLogoUrl ? (
                      <Image
                        src={offer.sellerLogoUrl}
                        alt={`${offer.sellerName} store logo`}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-green-700">
                        {offer.sellerName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {offer.sellerName}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-green-700">
                      <Check className="h-3.5 w-3.5" />
                      Active seller
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      GH {offer.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {offer.stockQuantity} available
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500">
                    {cartQuantity > 0 ? "In your cart" : "Ready to order"}
                  </span>

                  {cartItem ? (
                    <QuantitySelector
                      quantity={cartQuantity}
                      maxQuantity={offer.stockQuantity}
                      size="sm"
                      onIncrease={() =>
                        updateQuantity(cartItem.id, cartQuantity + 1)
                      }
                      onDecrease={() => {
                        if (cartQuantity <= 1) {
                          removeItem(cartItem.id);
                        } else {
                          updateQuantity(cartItem.id, cartQuantity - 1);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(offer)}
                      disabled={isAdding || offer.stockQuantity < 1}
                      className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {isAdding ? "Adding..." : "Add to cart"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <Store className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">
            No active sellers for this option.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Please select another option if available.
          </p>
        </div>
      )}
    </section>
  );
}
