"use client";

import { Menu, Bell, Search } from "lucide-react";
import { useSession } from "next-auth/react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  accentColor: string;
}

export default function TopBar({ title, subtitle, onMenuClick, accentColor }: TopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-500 hidden sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search (hidden on mobile for space) */}
          <button className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition">
            <Search className="w-4 h-4" />
            <span className="hidden lg:inline">Search...</span>
          </button>

          {/* Notifications */}
          <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
            <Bell className="w-5 h-5" />
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 ${accentColor} rounded-full`}></span>
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <div className={`w-8 h-8 ${accentColor} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
              {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                {session?.user?.name || "User"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}