"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  children?: SidebarItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  logo: string;
  accentColor: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  items,
  title,
  logo,
  accentColor,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  
  // 👇 NEW: Collapsible state for desktop
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  const isActive = (href: string) => {
    if (href === "/seller" || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Prevent hydration mismatch
  if (!isMounted) {
    return (
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:w-64 border-r border-gray-200 z-30 bg-white" />
    );
  }

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      {/* Logo/Header */}
      <div className={`h-16 flex items-center border-b border-gray-200 flex-shrink-0 ${isCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
        <div className={`w-9 h-9 ${accentColor} rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0`}>
          {logo}
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-sm truncate">{title}</h1>
            <p className="text-[10px] text-gray-500">iBUY Platform</p>
          </div>
        )}
        
        {/* 👇 NEW: Collapse Toggle Button (Desktop only) */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:block p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          
        </ul>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            <span>←</span>
            <span>Back to Store</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: Changed from 'fixed' to 'sticky' so it naturally pushes content */}
      <aside className={`hidden lg:block lg:sticky lg:top-0 lg:h-screen border-r border-gray-200 z-30 transition-all duration-300 ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        {sidebarContent}
      </aside>

      {/* Mobile/Tablet Drawer */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 shadow-xl">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}