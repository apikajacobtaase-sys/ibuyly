"use client";

import { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { SidebarItem } from "./Sidebar";

interface DashboardPageLayoutProps {
  sidebarItems: SidebarItem[];
  title: string;
  logo: string;
  accentColor: string;
  pageTitle: string;
  pageSubtitle?: string;
  children: ReactNode;
}

export default function DashboardPageLayout({
  sidebarItems,
  title,
  logo,
  accentColor,
  pageTitle,
  pageSubtitle,
  children,
}: DashboardPageLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar
        items={sidebarItems}
        title={title}
        logo={logo}
        accentColor={accentColor}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          items={sidebarItems}
          title={title}
          logo={logo}
          accentColor={accentColor}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      </div>

      <main className="min-w-0 flex-1">
        <TopBar
          title={pageTitle}
          subtitle={pageSubtitle}
          onMenuClick={() => setMenuOpen(true)}
          accentColor={accentColor}
        />

        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
