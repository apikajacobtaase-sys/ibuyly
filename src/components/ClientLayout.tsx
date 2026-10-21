 // src/components/ClientLayout.tsx
"use client";

import { useState } from "react";
import GlobalSidebar from "@/components/GlobalSidebar";
import Header from "@/components/Header";
import OnboardingBanner from "@/components/OnboardingBanner";
import DailyFeedbackPopup from "@/components/DailyFeedbackPopup";
import FloatingDock from "@/components/FloatingDock"; // ✅ Import

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <GlobalSidebar 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
         <OnboardingBanner />
        <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        
        <main className="flex-1">
          {children}
        </main>
      </div>
      
      {/* ✅ Add Floating Dock for Mobile */}
      <FloatingDock 
        onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} 
        isMenuOpen={mobileMenuOpen} 
      />
      
      <DailyFeedbackPopup />
    </div>
  );
}