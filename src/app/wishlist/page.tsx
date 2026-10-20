"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Trash2, ShoppingCart } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BottomNav from "@/components/BottomNav";
import { useCartStore } from "@/store/cartStore";

interface WishlistProduct {
  id: string;
  productId: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  sellerName?: string;
  stockQuantity: number;
}

export default function WishlistPage() {
  const { data: session } = useSession();
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (session) {
      fetchWishlist();
    } else {
      setIsLoading(false);
    }
  }, [session]);

  const fetchWishlist = async () => {
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      if (res.ok) {
        setWishlist(data.wishlist || []);
      }
    } catch (error) {
      console.error("Failed to fetch wishlist", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setWishlist(wishlist.filter((item) => item.productId !== productId));
    } catch (error) {
      console.error("Failed to remove from wishlist", error);
    }
  };

  const handleMoveToCart = (product: WishlistProduct) => {
    addItem({
      productId: product.productId,
      title: product.title,
      price: product.price,
      quantity: 1,
      sellerName: product.sellerName || "iBUY Store",
    });
    handleRemove(product.productId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ibuy-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ibuy-orange"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
        <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <h1 className="text-xl font-bold text-ibuy-text">My Wishlist</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-ibuy-text mb-2">Please log in to view your wishlist</h2>
          <p className="text-ibuy-text-secondary mb-6">Sign in to save and manage your favorite products</p>
          <Link href="/login" className="inline-block bg-ibuy-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition">
            Log In
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-ibuy-text">My Wishlist ({wishlist.length})</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {wishlist.length === 0 ? (
          <div className="text-center py-12 bg-ibuy-card rounded-lg border border-ibuy-border">
            <div className="text-6xl mb-4">💝</div>
            <h3 className="text-xl font-bold text-ibuy-text mb-2">Your wishlist is empty</h3>
            <p className="text-ibuy-text-secondary mb-6">Save products you love to buy them later</p>
            <Link href="/" className="inline-block bg-ibuy-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {wishlist.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard {...product} id={product.productId} />
                <div className="absolute top-2 right-2 flex flex-col gap-2 z-10">
                  <button
                    onClick={() => handleRemove(product.productId)}
                    className="p-1.5 bg-white rounded-full shadow-md hover:bg-red-50 transition"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                  <button
                    onClick={() => handleMoveToCart(product)}
                    className="p-1.5 bg-white rounded-full shadow-md hover:bg-ibuy-orange/10 transition"
                    title="Move to cart"
                  >
                    <ShoppingCart className="w-4 h-4 text-ibuy-orange" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}