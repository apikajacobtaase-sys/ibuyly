 "use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart, GitCompare, Star, AlertCircle } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCompareStore } from "@/store/compareStore";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface ProductCardProps {
  id: string; // productId
  title: string;
  slug: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  imageUrl?: string | null;
  sellerName?: string;
  stockQuantity?: number;
  avgRating?: number;
  reviewCount?: number;
  bestVariantId?: string | null; // 👈 ADDED: To ensure correct cart addition
  bestOfferId?: string | null;    // 👈 ADDED: To ensure correct seller stock deduction
}

export default function ProductCard({
  id,
  title,
  slug,
  price,
  compareAtPrice,
  imageUrl,
  sellerName,
  stockQuantity = 0,
  avgRating,
  reviewCount,
  bestVariantId,
  bestOfferId,
}: ProductCardProps) {
  const { data: session } = useSession();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlistStore();
  const { isInCompare, addItem: addCompareItem, removeItem: removeCompareItem } = useCompareStore();
  
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Sync mount state and wishlist state after hydration
  useEffect(() => {
    setIsMounted(true);
    setIsWishlisted(isInWishlist(id));
  }, [id, isInWishlist]);

  const numericPrice = typeof price === "string" ? parseFloat(price) : price;
  const numericCompare = compareAtPrice ? (typeof compareAtPrice === "string" ? parseFloat(compareAtPrice) : compareAtPrice) : null;
  
  const discount = numericCompare && numericCompare > numericPrice 
    ? Math.round(((numericCompare - numericPrice) / numericCompare) * 100) 
    : 0;

    const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (stockQuantity <= 0) {
      alert("This item is currently out of stock.");
      return;
    }

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: bestVariantId || id, 
          offerId: bestOfferId || null, // 👈 THIS MUST BE SENT!
          quantity: 1,
        }),
      });

      if (res.ok) {
        console.log("✅ Added to cart with offerId:", bestOfferId);
        // Trigger your cart UI update here
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add to cart");
      }
    } catch (error) {
      console.error("Network error adding to cart", error);
    }
  };
  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (session) {
      try {
        if (isWishlisted) {
          await fetch("/api/wishlist", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: id }),
          });
          removeWishlistItem(id);
          setIsWishlisted(false);
        } else {
          await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: id }),
          });
          addWishlistItem(id);
          setIsWishlisted(true);
        }
      } catch (error) {
        console.error("Wishlist toggle failed", error);
      }
    } else {
      if (isWishlisted) {
        removeWishlistItem(id);
        setIsWishlisted(false);
      } else {
        addWishlistItem(id);
        setIsWishlisted(true);
      }
    }
  };

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInCompare(id)) {
      removeCompareItem(id);
    } else {
      addCompareItem({
        id,
        title,
        slug,
        imageUrl,
        price: numericPrice,
      });
    }
  };

  return (
    <Link href={`/products/${slug}`} className="group block bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-100">
      <div className="relative aspect-square bg-gray-50">
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={title} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <span className="text-3xl">📦</span>
          </div>
        )}
        
        {discount > 0 && (
          <span className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            -{discount}%
          </span>
        )}

        {/* Action Buttons */}
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          <button 
            onClick={handleWishlistToggle}
            className="w-6 h-6 flex items-center justify-center bg-white/90 rounded-full shadow-sm hover:bg-white transition-colors"
            title={(isMounted && isWishlisted) ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart 
              className={`w-3 h-3 ${(isMounted && isWishlisted) ? "fill-red-500 text-red-500" : "text-gray-600"}`} 
            />
          </button>
          
          <button 
            onClick={handleCompareToggle}
            className={`w-6 h-6 flex items-center justify-center rounded-full shadow-sm transition ${
              isInCompare(id) 
                ? "bg-indigo-600 text-white" 
                : "bg-indigo-600/90 text-white hover:bg-indigo-600"
            }`}
            title={isInCompare(id) ? "Remove from compare" : "Add to compare"}
          >
            <GitCompare className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {/* Rating */}
        {avgRating && avgRating > 0 && (
          <div className="flex items-center gap-1 mb-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] font-medium text-gray-700">{avgRating}</span>
            {reviewCount !== undefined && (
              <span className="text-[10px] text-gray-400">({reviewCount})</span>
            )}
          </div>
        )}

        <h3 className="text-xs font-normal text-gray-800 line-clamp-2 mb-1 min-h-[2rem] leading-tight">
          {title}
        </h3>
        
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-sm font-bold text-orange-600">
            GH₵ {numericPrice.toFixed(2)}
          </span>
          {numericCompare && numericCompare > numericPrice && (
            <span className="text-[10px] text-gray-400 line-through">
              {numericCompare.toFixed(2)}
            </span>
          )}
        </div>

        {sellerName && (
          <p className="text-[10px] text-gray-500 mb-2 truncate">
            Sold by: {sellerName}
          </p>
        )}

        {/* 👇 NEW: Live Stock Status Indicator */}
        <div className="mb-2">
          {stockQuantity > 10 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              In Stock
            </span>
          ) : stockQuantity > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded w-fit">
              <AlertCircle className="w-3 h-3" />
              Low Stock: Only {stockQuantity} left!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Out of Stock
            </span>
          )}
        </div>

        {/* 👇 UPDATED: Add to Cart Button with Loading & Disabled States */}
        <button
          onClick={handleAddToCart}
          disabled={stockQuantity <= 0 || isAdding}
          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors border ${
            stockQuantity <= 0 
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-500 hover:text-white hover:border-orange-500"
          }`}
        >
          {isAdding ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShoppingCart className="w-3 h-3" />
          )}
          {stockQuantity <= 0 ? "Out of Stock" : isAdding ? "Adding..." : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}