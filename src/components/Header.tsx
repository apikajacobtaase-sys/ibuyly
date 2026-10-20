 // src/components/Header.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, X, Bell, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import Logo from "./Logo";

export default function Header() {
  const { status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      const fetchUnreadCount = async () => {
        try {
          const res = await fetch("/api/notifications?unreadOnly=true");
          const data = await res.json();
          if (res.ok) setUnreadNotifications(data.unreadCount || 0);
        } catch (error) {
          console.error("Failed to fetch notifications", error);
        }
      };
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      
      {/* ✅ ROW 1: Logo & Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        
        {/* Left: Logo + Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Logo />
        </div>

        {/* Right: Cart & Notifications */}
        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition">
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
          
          {status === "authenticated" && (
            <Link href="/account/notifications" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition">
              <Bell className="w-6 h-6" />
              {unreadNotifications > 0 && (
                <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* ✅ ROW 2: Search Bar (Full Width on Mobile, Centered on Desktop) */}
      <div className="px-4 pb-3 md:px-6 md:pb-4">
        <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, categories..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-transparent focus:bg-white border focus:border-green-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all"
          />
        </form>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200 shadow-inner">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-gray-700 font-medium rounded-lg hover:bg-green-50 hover:text-green-700">Home</Link>
          <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-gray-700 font-medium rounded-lg hover:bg-green-50 hover:text-green-700">All Products</Link>
          <Link href="/categories" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-gray-700 font-medium rounded-lg hover:bg-green-50 hover:text-green-700">Categories</Link>
          
          {status === "authenticated" ? (
            <>
              <div className="border-t border-gray-100 my-2" />
              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-gray-700 font-medium rounded-lg hover:bg-green-50 hover:text-green-700">My Dashboard</Link>
              <Link href="/account/orders" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-gray-700 font-medium rounded-lg hover:bg-green-50 hover:text-green-700">My Orders</Link>
              <div className="border-t border-gray-100 my-2" />
              <button 
                onClick={() => { setMobileMenuOpen(false); /* signOut logic */ }} 
                className="block w-full text-left px-3 py-3 text-rose-600 font-medium rounded-lg hover:bg-rose-50"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block mt-4 px-3 py-3 text-center bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Log In / Sign Up</Link>
          )}
        </div>
      )}
    </header>
  );
}