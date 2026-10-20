// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalSidebar from "@/components/GlobalSidebar";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import OnboardingBanner from "@/components/OnboardingBanner";
import DailyFeedbackPopup from "@/components/DailyFeedbackPopup"; // ✅ Added

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
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <Providers>
          <div className="flex min-h-screen">
            <GlobalSidebar />
            
            <div className="flex-1 flex flex-col min-w-0">
               <OnboardingBanner />
              <Header />
              
              <main className="flex-1">
                {children}
              </main>
              
              <BottomNav />
            </div>
          </div>
          
          {/* ✅ Added: Feedback Popup outside the main layout div so it floats on top */}
          <DailyFeedbackPopup />
        </Providers>
      </body>
    </html>
  );
}