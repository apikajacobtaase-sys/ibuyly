
"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Store, Shield, AlertCircle, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function OnboardingBanner() {
  const { data: session, status } = useSession();
  const [isVisible, setIsVisible] = useState(true);
  const [needsSellerSetup, setNeedsSellerSetup] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      if (status === "authenticated" && session?.user?.role === "SELLER") {
        try {
          // Check if the seller profile exists
          const res = await fetch("/api/seller/profile");
          const data = await res.json();
          if (!res.ok || !data.profile) {
            setNeedsSellerSetup(true);
          }
        } catch (error) {
          console.error("Failed to check seller profile", error);
        }
      }
    }
    checkProfile();
  }, [status, session]);

  if (!isVisible) return null;

  return (
    <>
      {/* SELLER ONBOARDING BANNER */}
      {needsSellerSetup && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg">Welcome, Seller! 🎉</p>
                <p className="text-indigo-100 text-sm">
                  Your account has been upgraded. Complete your store setup to start receiving orders.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link 
                href="/seller/setup" 
                className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition-colors shadow-sm"
              >
                Complete Store Setup
              </Link>
              <button onClick={() => setIsVisible(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    

{/* ADMIN WELCOME BANNER */}
{status === "authenticated" && session?.user?.role === "ADMIN" && (
  <div className="bg-blue-50 border-b border-blue-200 p-4">
    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-blue-600" />
        <div>
          <p className="font-bold text-blue-900">🎉 Admin Access Granted!</p>
          <p className="text-blue-700 text-sm">
            Your account has been upgraded. You can now manage categories, users, and platform settings.
          </p>
        </div>
      </div>
      <Link 
        href="/admin" 
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
      >
        Go to Admin Panel
      </Link>
    </div>
  </div>
)}
</>
     
    
  );
}