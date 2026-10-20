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
      
      {/* ROW 1: Logo & Actions */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-md">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Logo />
        </div>

        <div className="flex items-center gap-1">
          <Link href="/cart" className="relative p-1.5 text-gray-600 hover:bg-gray-100 rounded-full">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-green-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                {cartCount}
              </span>
            )}
          </Link>
          {status === "authenticated" && (
            <Link href="/account/notifications" className="relative p-1.5 text-gray-600 hover:bg-gray-100 rounded-full">
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                  {unreadNotifications}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* ROW 2: Single Search Bar (Full Width) */}
      <div className="px-3 pb-2">
        <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </form>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1 animate-in slide-in-from-top-2">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700 font-medium rounded-lg hover:bg-green-50">Home</Link>
          <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700 font-medium rounded-lg hover:bg-green-50">All Products</Link>
          {/* ... other links ... */}
        </div>
      )}
    </header>
  );
}