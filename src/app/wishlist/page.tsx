 // src/app/account/wishlist/page.tsx
"use client";

import { useEffect, useState } from "react"; // ✅ Added useState
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useWishlistStore, WishlistItem } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";

export default function WishlistPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem: addCartItem } = useCartStore();

  // ✅ Fix: Use state to ensure we only render after hydration
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/account/wishlist");
    }
  }, [status, router]);

  if (!isMounted || status === "loading") {
    return (
      <AccountSubPageLayout title="My Wishlist">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      </AccountSubPageLayout>
    );
  }

  if (status === "unauthenticated") return null;

  const formatCurrency = (amount: number) => `GH₵ ${amount.toFixed(2)}`;

  const handleMoveToCart = (item: WishlistItem) => {
    // ✅ Fix: Ensure all required fields are present for the Cart Store
    addCartItem({
      productId: item.id,
      variantId: item.variantId || "default-variant", 
      offerId: item.offerId || "default-offer",     
      title: item.title,
      price: item.price,
      imageUrl: item.imageUrl,
      stockQuantity: 99, // Safe default
      sellerId: item.sellerId || "unknown",
      sellerName: item.sellerName || "iBUY Marketplace",
      quantity: 1,
    });
    
    // Optional: Provide feedback
    alert("Moved to cart!"); 
  };

  return (
    <AccountSubPageLayout title="My Wishlist">
      <div className="max-w-4xl mx-auto p-4 pb-20">
        
        {!isMounted ? null : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Your wishlist is empty</h2>
            <p className="text-gray-500 mt-2 mb-6 max-w-sm mx-auto">
              Save items you love to keep track of them.
            </p>
            <Link 
              href="/categories" 
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{items.length} items saved</p>
              <button 
                onClick={() => clearWishlist()} 
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden group relative flex flex-col">
                  
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-red-50 hover:text-red-600 transition z-10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link href={`/products/${item.slug}`} className="block flex-1">
                    <div className="aspect-square bg-gray-100 relative">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 h-10">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">{item.sellerName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-700">{formatCurrency(item.price)}</span>
                      </div>
                    </div>
                  </Link>
                  
                  <div className="px-3 pb-3 mt-auto">
                    <button 
                      onClick={() => handleMoveToCart(item)}
                      className="block w-full text-center py-2 text-xs font-semibold border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Move to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AccountSubPageLayout>
  );
}