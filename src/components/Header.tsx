 // src/components/Header.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, X, Bell, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import Logo from "./Logo"; // ✅ Import the Logo

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
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="px-4 py-3 flex items-center gap-3">
        
        {/* ✅ 1. LOGO (Visible on all screens) */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* 2. Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* 3. Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-3xl mx-auto hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
            />
          </div>
        </form>

        {/* 4. Right Actions (Mobile Only) */}
        <div className="md:hidden flex items-center gap-1 flex-shrink-0 ml-auto">
          <Link href="/cart" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
          
          {status === "authenticated" && (
            <Link href="/account/notifications" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell className="w-6 h-6" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Search (Visible only on mobile) */}
      <div className="md:hidden px-4 pb-3">
         <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search iBUY..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </form>
      </div>

      {/* 5. Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Home</Link>
          <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">All Products</Link>
          <Link href="/categories" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Categories</Link>
          
          {status === "authenticated" ? (
            <>
              <div className="border-t border-gray-100 my-2" />
              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">My Dashboard</Link>
              <Link href="/account/orders" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">My Orders</Link>
              <Link href="/account/notifications" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Notifications</Link>
              <div className="border-t border-gray-100 my-2" />
              <button 
                onClick={() => { setMobileMenuOpen(false); /* signOut logic */ }} 
                className="block w-full text-left px-3 py-2.5 text-rose-600 font-medium rounded-lg hover:bg-rose-50"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-green-600 font-semibold rounded-lg hover:bg-green-50">Log In / Sign Up</Link>
          )}
        </div>
      )}
    </header>
  );
}