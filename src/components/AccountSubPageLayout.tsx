// src/components/AccountSubPageLayout.tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MobileBottomNav from "./MobileBottomNav";

export default function AccountSubPageLayout({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Mobile Header with Back Button */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/account" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-20">
         <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {children}
      </main>

      {/* Fixed Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}