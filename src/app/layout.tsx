 // src/app/layout.tsx
"use client"; // ✅ Changed to Client Component to manage state

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalSidebar from "@/components/GlobalSidebar";
import Header from "@/components/Header";
import OnboardingBanner from "@/components/OnboardingBanner";
import DailyFeedbackPopup from "@/components/DailyFeedbackPopup";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iBUY Marketplace",
  description: "Ghana's premier multi-vendor e-commerce platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ State to control the mobile sidebar
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <Providers>
          <div className="flex min-h-screen">
            
            {/* ✅ Pass state and setter to Sidebar */}
            <GlobalSidebar 
              isOpen={mobileMenuOpen} 
              onClose={() => setMobileMenuOpen(false)} 
            />
            
            <div className="flex-1 flex flex-col min-w-0">
               <OnboardingBanner />
              
              {/* ✅ Pass setter to Header so the hamburger button works */}
              <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
              
              <main className="flex-1">
                {children}
              </main>
              
              {/* ✅ BottomNav removed as requested */}
            </div>
          </div>
          
          <DailyFeedbackPopup />
        </Providers>
      </body>
    </html>
  );
}