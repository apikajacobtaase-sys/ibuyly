 // src/components/ClientLayout.tsx
"use client";

import { useState } from "react";
import GlobalSidebar from "@/components/GlobalSidebar";
import Header from "@/components/Header";
import OnboardingBanner from "@/components/OnboardingBanner";
import DraggableFAB from "@/components/DraggableFAB";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-white">
      <GlobalSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onCollapseChange={(collapsed) => setIsSidebarCollapsed(collapsed)}
      />
      
      {/* 
         ✅ flex-1 ensures this area takes up all remaining space.
         When the sidebar shrinks, this area automatically expands.
      */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        <OnboardingBanner />

        <Header
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 p-4 md:p-6 w-full">
          {children}
        </main>
      </div>

      <DraggableFAB />
    </div>
  );
}