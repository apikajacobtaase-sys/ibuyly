"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar, { type SidebarItem } from "./Sidebar";

interface DashboardShellProps {
  sidebarItems: SidebarItem[];
  title: string;
  logo: string;
  accentColor: string;
  children: React.ReactNode;
}

export default function DashboardShell({
  sidebarItems,
  title,
  logo,
  accentColor,
  children,
}: DashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen min-w-0 bg-gray-50 lg:flex">
      <Sidebar
        items={sidebarItems}
        title={title}
        logo={logo}
        accentColor={accentColor}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="min-w-0 min-h-screen flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentColor} text-sm font-bold text-white`}>
              {logo}
            </span>
            <span className="truncate text-sm font-semibold text-gray-900">
              {title}
            </span>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
