 // src/components/Header.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Menu } from "lucide-react";
import Logo from "./Logo";

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { status } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
      <div className="px-3 py-2 flex items-center justify-between">
        
        {/* Left: Menu & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="md:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Logo />
        </div>

        {/* Right: Desktop Actions Only */}
        <div className="hidden md:flex items-center gap-4">
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

      {/* Search Bar */}
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
    </header>
  );
}