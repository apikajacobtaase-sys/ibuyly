// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // Assuming you have a NextAuth/Query provider wrapper
import GlobalSidebar from "@/components/GlobalSidebar";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header"; // We will simplify this next
import OnboardingBanner from "@/components/OnboardingBanner";

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
            {/* 👈 GLOBAL SIDEBAR (Desktop Only) */}
            <GlobalSidebar />
            
            {/* 👈 MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0">
               <OnboardingBanner />
              {/* Simplified Header (Search + Mobile actions) */}
              <Header />
              
              <main className="flex-1">
                {children}
              </main>
              
              {/* Mobile Bottom Nav */}
              <BottomNav />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}