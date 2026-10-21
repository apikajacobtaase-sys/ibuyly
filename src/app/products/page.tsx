 // src/app/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart, Loader2 } from "lucide-react";
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
        const res = await fetch("/api/search?q=&page=1&limit=24");
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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    // ✅ White Background for the whole page
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header Section */}
        <div className="mb-8 border-b border-gray-100 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
          <p className="text-gray-500 mt-1">Discover the best deals from our top sellers.</p>
        </div>
      
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const isWishlisted = isInWishlist(product.id);
            
            return (
              // ✅ Clean White Card with Subtle Border
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group relative flex flex-col hover:shadow-lg transition-shadow duration-300">
                
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
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm z-10 hover:bg-white transition"
                >
                  <Heart className={`w-5 h-5 transition ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                </button>

                <Link href={`/products/${product.slug}`} className="flex-1 flex flex-col">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.imageUrl ? (
                      <Image 
                        src={product.imageUrl} 
                        alt={product.title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500" 
                        unoptimized 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    {/* ✅ Black Text for Title */}
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 leading-tight">
                      {product.title}
                    </h3>
                    
                    <p className="text-xs text-gray-500 mb-3">{product.sellerName}</p>
                    
                    {/* ✅ Green Price */}
                    <div className="mt-auto">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Add to Cart Button */}
                <div className="p-4 pt-0 mt-auto">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!product.bestOfferId || !product.bestVariantId) {
                        alert("This product is currently unavailable.");
                        return;
                      }

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
                        variantId: product.bestVariantId,
                        offerId: product.bestOfferId,
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
                    className={`w-full py-2.5 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${
                      product.inStock 
                        ? "bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md" 
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
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

        {products.length === 0 && !loading && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No products found at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}