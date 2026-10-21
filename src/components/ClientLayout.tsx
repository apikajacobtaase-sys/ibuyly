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
    // ✅ 1. Lock to screen height
    <div className="flex h-screen w-full overflow-hidden bg-white">
      
      {/* ✅ 2. Sidebar is static in flow, handles its own internal scroll */}
      <GlobalSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onCollapseChange={(collapsed) => setIsSidebarCollapsed(collapsed)}
      />
      
      {/* ✅ 3. Main Area takes remaining width and full height */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Header is fixed at top of this column */}
        <div className="flex-shrink-0 z-20">
           <OnboardingBanner />
           <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        </div>

        {/* ✅ 4. Main Content scrolls independently */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full scroll-smooth">
          {children}
        </main>
      </div>

      <DraggableFAB />
    </div>
  );
}