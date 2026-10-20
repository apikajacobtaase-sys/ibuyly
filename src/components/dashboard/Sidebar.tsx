 // src/components/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";

// 👇 UPDATED: Use iconName (string) instead of icon (component)
export interface SidebarItem {
  label: string;
  href: string;
  iconName: string; // 👈 String instead of component
  badge?: number | string;
  highlight?: boolean;
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

  // Helper to safely get the icon component from the string name
  const getIcon = (iconName: string) => {
    return (LucideIcons as any)[iconName] || LayoutDashboard;
  };

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
        
        {/* Collapse Toggle Button */}
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
          {(items || []).map((item) => {
            // 👇 SAFELY GET THE ICON COMPONENT FROM THE STRING
            const IconComponent = getIcon(item.iconName);
            const active = isActive(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={isCollapsed ? item.label : ""}
                  className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {/* 👇 RENDER THE RESOLVED COMPONENT */}
                  <IconComponent className={`w-5 h-5 flex-shrink-0 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                  
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.highlight && (
                        <span className="w-2 h-2 rounded-full bg-rose-500" title="New/Important" />
                      )}
                      {item.badge !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
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
      {/* Desktop Sidebar */}
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