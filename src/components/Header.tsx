"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Menu, User } from "lucide-react";
import Logo from "./Logo";

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const router = useRouter();

  const avatarUrl = session?.user?.avatarUrl || session?.user?.image;
  const displayName = session?.user?.name || "Account";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

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

  const ProfileAvatar = ({ size = "h-9 w-9" }: { size?: string }) => (
    <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-bold text-gray-700`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-2">
        {/* Left: Menu & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Logo />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {status === "unauthenticated" && (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-gray-800 md:hidden"
              >
                <User className="h-3 w-3" />
                <span>Log In</span>
              </Link>

              <Link
                href="/login"
                className="hidden min-h-10 items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 md:inline-flex"
              >
                <User className="h-4 w-4" />
                Log In
              </Link>
            </>
          )}

          {status === "authenticated" && (
            <>
              {/* Mobile profile avatar */}
              <Link
                href="/account/settings"
                className="rounded-full transition hover:ring-2 hover:ring-green-500 md:hidden"
                aria-label="Profile settings"
              >
                <ProfileAvatar size="h-9 w-9" />
              </Link>

              {/* Desktop actions */}
              <div className="hidden items-center gap-3 md:flex">
                <Link
                  href="/account/notifications"
                  className="relative rounded-full p-2 text-gray-600 transition hover:bg-gray-100"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-rose-600 px-0.5 text-[9px] font-bold text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </Link>

                <Link
                  href="/account/settings"
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <ProfileAvatar size="h-8 w-8" />
                  <span className="max-w-28 truncate">{displayName}</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <form onSubmit={handleSearch} className="relative mx-auto max-w-3xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-lg border-none bg-gray-100 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </form>
      </div>
    </header>
  );
}
