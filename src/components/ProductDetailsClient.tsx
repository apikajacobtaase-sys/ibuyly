// src/components/ProductDetailsClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Share2, Star, ShoppingCart, Store } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

import QuantitySelector from "@/components/QuantitySelector";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";

interface SellerOffer {
  offerId: string;
  sellerId: string;
  sellerName: string;
  price: number;
  stockQuantity: number;
  status: string;
}

interface Variant {
  id: string;
  offerId: string | null; // 👈 ADD THIS
  name: string;
  basePrice: number;
  offers: SellerOffer[];
}

interface Product {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  images: string[];
  variants: Variant[];
  category: { name: string; slug: string };
  reviews: any[];
  rating: number;
  reviewCount: number;
}

export default function ProductDetailsClient({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, updateQuantity, removeItem, items } = useCartStore();
  
  const [selectedImage, setSelectedImage] = useState(0);
  
  const defaultVariant: Variant = {
    id: product.id,
    name: "Default",
    offerId: null, // 👈 ADD THIS
    basePrice: 0,
    offers: [],
  };
  
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants.length > 0 ? product.variants[0] : defaultVariant
  );

  const formatCurrency = (amount: number) => `GH₵ ${amount.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{product.title}</h1>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <Share2 className="w-5 h-5 text-gray-700" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto bg-white md:rounded-lg md:shadow-sm md:my-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-8">
          
          {/* LEFT COLUMN: Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative main-product-image">
              {product.images[selectedImage] ? (
                <Image src={product.images[selectedImage]} alt={product.title} fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingCart className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${selectedImage === idx ? "border-green-600" : "border-gray-200"}`}
                  >
                    <Image src={img} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Details & Sellers */}
          <div className="space-y-6">
            <div>
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">{product.category?.name}</p>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold text-gray-900">{product.rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">({product.reviewCount} reviews)</span>
              </div>
            </div>

            {product.description && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Variant Selector */}
            {product.variants.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Select Option:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => {
                    const hasStock = variant.offers.some((o) => o.stockQuantity > 0);
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        disabled={!hasStock}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                          selectedVariant.id === variant.id
                            ? "border-green-600 bg-green-50 text-green-700"
                            : !hasStock
                            ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        {variant.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 👇 AVAILABLE SELLERS LIST (Stage 5 Requirement) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-green-600" />
                Available Sellers
              </h3>
              
              {selectedVariant.offers && selectedVariant.offers.length > 0 ? (
                <div className="space-y-3">
                  {selectedVariant.offers.map((offer) => {
                    const isOfferInStock = offer.stockQuantity > 0;
                    const cartItem = items.find(
                      (i) => i.productId === product.id && i.variantId === selectedVariant.id && i.offerId === offer.offerId
                    );
                    const cartQty = cartItem?.quantity || 0;

                    return (
                      <div key={offer.offerId} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <Store className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-gray-900 block">{offer.sellerName}</span>
                              <span className={`text-xs font-medium ${isOfferInStock ? "text-green-600" : "text-red-600"}`}>
                                {isOfferInStock ? `${offer.stockQuantity} available` : "Out of Stock"}
                              </span>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{formatCurrency(offer.price)}</span>
                        </div>
                        
                        <div className="flex items-center justify-end">
                          {cartQty > 0 ? (
                            <QuantitySelector
                              quantity={cartQty}
                              maxQuantity={offer.stockQuantity}
                              onIncrease={() => {
                                if (cartItem) updateQuantity(cartItem.id, cartQty + 1);
                              }}
                              onDecrease={() => {
                                if (cartItem) {
                                  if (cartQty <= 1) removeItem(cartItem.id);
                                  else updateQuantity(cartItem.id, cartQty - 1);
                                }
                              }}
                              size="sm"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                if (isOfferInStock) {
                                  const imgElement = document.querySelector('.main-product-image');
                                  if (imgElement) {
                                    const rect = getElementRect(imgElement as HTMLElement);
                                    triggerFlyToCart({
                                      imageUrl: product.images[0] || '',
                                      startX: rect.x,
                                      startY: rect.y,
                                      id: Date.now().toString(),
                                    });
                                  }
                                   addItem({
  productId: product.id,
  variantId: selectedVariant.id,
  offerId: offer.offerId, // FIX: Use the selected seller's actual offer ID
  title: product.title,
  price: offer.price,
  imageUrl: product.images[0] || null,
  stockQuantity: offer.stockQuantity,
  sellerId: offer.sellerId,
  sellerName: offer.sellerName,
  quantity: 1,
});
                                }
                              }}
                              disabled={!isOfferInStock}
                              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition flex items-center gap-2 ${
                                isOfferInStock 
                                  ? "bg-green-600 hover:bg-green-700 text-white" 
                                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Add to Cart
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-lg text-center text-sm text-gray-500 border border-dashed border-gray-300">
                  No sellers currently have this item in stock.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}