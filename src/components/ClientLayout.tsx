"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import GlobalSidebar from "@/components/GlobalSidebar";
import Header from "@/components/Header";
import OnboardingBanner from "@/components/OnboardingBanner";
import DraggableFAB from "@/components/DraggableFAB";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import CompareBar from "@/components/CompareBar";
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Seller and admin dashboards have their own independent navigation.
  const isSellerRoute = pathname === "/seller" || pathname.startsWith("/seller/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isSellerRoute || isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-white">
      <GlobalSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex-shrink-0">
          <OnboardingBanner />
          <Header onMenuToggle={() => setMobileMenuOpen((open) => !open)} />
        </div>

        <PWAInstallPrompt />

        <main className="w-full min-w-0 flex-1 p-3 sm:p-4 md:p-6 scroll-smooth">
          {children}
        </main>
      </div>
     <DraggableFAB />
<CompareBar />
    </div>
  );
}
