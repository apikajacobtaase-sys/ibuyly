 // src/components/GlobalSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore";
import { useState, useEffect } from "react";
import { 
  Home, ShoppingBag, Tag, LayoutDashboard, Package, 
  Bell, MapPin, Settings, Store, LogOut, ShoppingCart, 
  User, Shield, Heart, ChevronLeft, ChevronRight, Users, PackagePlus,MessageSquare, X
} from "lucide-react";

const browseLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "All Products", icon: ShoppingBag },
  { href: "/categories", label: "Categories", icon: Tag },
];

const accountLinks = [
  { href: "/account", label: "My Dashboard", icon: LayoutDashboard },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/addresses", label: "Saved Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

interface GlobalSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function GlobalSidebar({ isOpen, onClose, onCollapseChange }: GlobalSidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const isAuthenticated = status === "authenticated";
  const userRole = session?.user?.role as string | undefined;

  const isSeller = userRole === "SELLER_OWNER" || userRole === "SELLER_STAFF" || userRole === "SUPER_ADMIN";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
    
    if (onCollapseChange) {
      onCollapseChange(newState);
    }
  };

  const isActive = (path: string) => pathname === path || pathname?.startsWith(`${path}/`);

  const renderLink = (link: { href: string; label: string; icon: any }) => {
    const Icon = link.icon;
    const active = isActive(link.href);
    
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          active
            ? "bg-green-50 text-green-700"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-green-600" : "text-gray-400"}`} />
        <span className="truncate">{link.label}</span>
      </Link>
    );
  };

  if (!isMounted) return null;

  return (
    <>
      {/* ✅ Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" 
          onClick={onClose}
        />
      )}

      {/* ✅ Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 
        transform transition-all duration-300 ease-in-out
        md:translate-x-0 md:static md:h-full md:border-r
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        ${isCollapsed ? "md:w-20" : "md:w-72"}
      `}>
        
        {/* Mobile Header inside Sidebar */}
        <div className="md:hidden p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-lg text-green-600">Menu</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* ✅ Flex Column Wrapper for Desktop Structure */}
        <div className="hidden md:flex flex-col h-full">
          
          {/* 1. Brand & Toggle (Fixed at top) */}
          <div className={`flex-shrink-0 p-4 border-b border-gray-100 items-center ${isCollapsed ? "justify-center flex" : "flex justify-between"}`}>
            <Link href="/" className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && <span className="text-xl font-bold text-gray-900 tracking-tight">iBUY</span>}
            </Link>
            
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* 2. Scrollable Navigation (Takes remaining space) */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-6">
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Browse</h3>
              <nav className="space-y-1">
                {browseLinks.map(renderLink)}
              </nav>
            </div>

            {isAuthenticated && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</h3>
                <nav className="space-y-1">
                  {accountLinks.map(renderLink)}
                </nav>
              </div>
            )}

            {isAuthenticated && (isSeller || isAdmin) && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Management</h3>
                <nav className="space-y-1">
                  {isSeller && renderLink({ href: "/seller", label: "Seller Dashboard", icon: Store })}
                  {isSeller && renderLink({ href: "/seller/stocking", label: "Stock Products", icon: PackagePlus })}
                  {isAdmin && renderLink({ href: "/admin", label: "Admin Dashboard", icon: Shield })}
                  {isSuperAdmin && renderLink({ href: "/admin/users", label: "User Management", icon: Users })}
                </nav>
              </div>
            )}
          </div>

          {/* 3. Bottom Actions (Fixed at bottom) */}
          <div className="flex-shrink-0 p-3 border-t border-gray-100 space-y-2 bg-gray-50/50">
            <Link
              href="/cart"
              onClick={onClose}
              className={`flex items-center ${isCollapsed ? "justify-center w-12 h-12 mx-auto" : "justify-between px-4 py-3"} bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm relative`}
            >
              <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-semibold text-sm">View Cart</span>}
              </div>
              {cartCount > 0 && !isCollapsed && (
                <span className="bg-white text-green-600 text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                  {cartCount > 99 ? "9+" : cartCount}
                </span>
              )}
            </Link>
            
            {isAuthenticated && (
               <button
                onClick={() => { signOut({ callbackUrl: "/" }); onClose(); }}
                className={`flex items-center ${isCollapsed ? "justify-center w-10 h-10 mx-auto mt-2" : "gap-3 w-full px-3 py-2 mt-2"} text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors`}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && "Log Out"}
              </button>
            )}
          </div>

        </div>

        {/* ✅ MOBILE NAVIGATION (Visible only on mobile) */}
        <div className="md:hidden flex flex-col h-full pb-20">
           <div className="flex-1 overflow-y-auto p-3 space-y-6">
            
            {/* Browse Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Browse</h3>
              <nav className="space-y-1">
                {browseLinks.map(renderLink)}
              </nav>
            </div>

            {/* Account Section */}
            {isAuthenticated && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</h3>
                <nav className="space-y-1">
                  {accountLinks.map(renderLink)}
                </nav>
              </div>
            )}

            {/* Management Section */}
            {isAuthenticated && (isSeller || isAdmin) && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Management</h3>
                <nav className="space-y-1">
                  {isSeller && renderLink({ href: "/seller", label: "Seller Dashboard", icon: Store })}
                  {isSeller && renderLink({ href: "/seller/stocking", label: "Stock Products", icon: PackagePlus })}
                  {isSeller && renderLink({ href: "/seller/inbox", label: "Messages", icon: MessageSquare })}
                  {isAdmin && renderLink({ href: "/admin", label: "Admin Dashboard", icon: Shield })}
                  {isSuperAdmin && renderLink({ href: "/admin/users", label: "User Management", icon: Users })}
                </nav>
              </div>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}