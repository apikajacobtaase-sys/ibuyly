 // src/app/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { triggerFlyToCart, getElementRect } from "@/lib/cartAnimation";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  imageUrl?: string | null;
  sellerName?: string;
  sellerId?: string;
  stockQuantity: number;
  inStock: boolean;
  bestVariantId?: string;
  bestOfferId?: string | null;
}

export default function AllProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { addItem } = useCartStore();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist } = useWishlistStore();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/search?q=&page=1&limit=20");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const formatCurrency = (amount: number) => `GH₵ ${amount.toFixed(2)}`;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Products</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => {
          const isWishlisted = isInWishlist(product.id);
          
          return (
            <div key={product.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden group relative flex flex-col">
              
              {/* Wishlist Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isWishlisted) removeWishlistItem(product.id);
                  else addWishlistItem({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    imageUrl: product.imageUrl,
                    slug: product.slug,
                    sellerName: product.sellerName || "iBUY",
                  });
                }}
                className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm z-10"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
              </button>

              <Link href={`/products/${product.slug}`} className="flex-1 flex flex-col">
                <div className="aspect-square bg-gray-100 relative">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ShoppingCart className="w-8 h-8 text-gray-400" /></div>
                  )}
                </div>
                
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{product.title}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.sellerName}</p>
                  <span className="text-sm font-bold text-green-700">{formatCurrency(product.price)}</span>
                </div>
              </Link>

              {/* Add to Cart Button */}
              <div className="p-3 pt-0 mt-auto">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    
                    // ✅ FIX: Check for required IDs before adding
                    if (!product.bestOfferId || !product.bestVariantId) {
                      alert("This product is currently unavailable.");
                      return;
                    }

                    // Fly to cart animation
                    const imgElement = e.currentTarget.closest('.group')?.querySelector('img');
                    if (imgElement) {
                      const rect = getElementRect(imgElement as HTMLElement);
                      triggerFlyToCart({
                        imageUrl: product.imageUrl || '',
                        startX: rect.x,
                        startY: rect.y,
                        id: Date.now().toString(),
                      });
                    }

                    addItem({
                      productId: product.id,
                      variantId: product.bestVariantId, // ✅ Pass Variant ID
                      offerId: product.bestOfferId,     // ✅ Pass Offer ID
                      title: product.title,
                      price: product.price,
                      imageUrl: product.imageUrl,
                      stockQuantity: product.stockQuantity,
                      sellerId: product.sellerId || "unknown",
                      sellerName: product.sellerName || "iBUY Marketplace",
                      quantity: 1,
                    });
                  }}
                  disabled={!product.inStock}
                  className={`w-full py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                    product.inStock 
                      ? "bg-green-600 hover:bg-green-700 text-white" 
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {product.inStock ? "Add to Cart" : "Out of Stock"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}