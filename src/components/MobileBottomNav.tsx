// src/components/MobileBottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, Heart, UserRound } from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "categories", label: "Categories", icon: LayoutGrid, href: "/categories" },
    { id: "cart", label: "Cart", icon: ShoppingCart, href: "/cart" },
    { id: "wishlist", label: "Wishlist", icon: Heart, href: "/account/wishlist" },
    { id: "account", label: "Account", icon: UserRound, href: "/account" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          // Highlight based on current pathname
          const isActive = 
            (item.id === "account" && pathname.startsWith("/account")) ||
            (item.id !== "account" && pathname === item.href);
            
          const Icon = item.icon;
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full relative transition-colors ${
                isActive ? "text-orange-600" : "text-gray-500"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className={`text-[11px] mt-1 font-medium ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
}