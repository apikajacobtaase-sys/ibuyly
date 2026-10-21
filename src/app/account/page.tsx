// src/app/account/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { 
  Search, Heart, Store, History, MapPin, User, 
  Bell, ShieldAlert, LogOut, ChevronRight, 
  Package, Mail, Star, Ticket, MessageCircle, 
  Phone, HelpCircle, Edit2, Wallet
} from "lucide-react";

// Helper to create login links for guests
const getLoginHref = (destination: string) => `/login?callbackUrl=${encodeURIComponent(destination)}`;

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isGuest = status === "unauthenticated" || status === "loading";
  const isAuthenticated = status === "authenticated";

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const userName = session?.user?.name || session?.user?.firstName || "Customer";
  const userEmail = session?.user?.email || "";
  const userInitial = userName.charAt(0).toUpperCase();

  // WhatsApp configuration (Add NEXT_PUBLIC_WHATSAPP_NUMBER to your .env)
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "233000000000"; 
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      
      <main className="max-w-4xl mx-auto">
        
        {/* ==========================================
            SECTION B: WELCOME / GREETING HEADER
        ========================================== */}
        <div className="bg-white px-5 py-5 border-b border-gray-100">
          {isGuest ? (
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-900">Welcome</h1>
              <p className="text-sm text-gray-500 mt-1 mb-4">Enter your account</p>
              <Link 
                href={getLoginHref("/account")}
                className="w-full md:w-auto self-start bg-green-600 text-white font-semibold text-sm px-8 py-2.5 rounded-full hover:bg-green-700 transition-colors text-center"
              >
                LOGIN
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xl font-bold">
                  {userInitial}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Hello, {userName}</h1>
                  <p className="text-sm text-gray-500 truncate max-w-[200px]">{userEmail}</p>
                </div>
              </div>
              <Link href="/account/settings" className="text-green-600 text-sm font-semibold flex items-center gap-1">
                <Edit2 className="w-3.5 h-3.5" />
                EDIT
              </Link>
            </div>
          )}
        </div>

        {/* ==========================================
            SECTION C: WALLET / BALANCE ROW
        ========================================== */}
        <Link 
          href={isGuest ? getLoginHref("/account") : "/account/vouchers"} 
          className="flex items-center justify-between bg-white px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-900">
              {isGuest ? "Login to see your balance" : "iBUY Store Credit"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isGuest ? "text-gray-400" : "text-green-600"}`}>
              {isGuest ? "GH₵ 0.00" : "GH₵ 0.00"} {/* Replace 0.00 with real balance if implemented */}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </Link>

        {/* ==========================================
            SECTION D: CUSTOMER ASSISTANCE
        ========================================== */}
        <div className="bg-white px-5 py-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <Link 
              href={isGuest ? getLoginHref("/account/support") : "/account/support"}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm py-3 rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Live Chat
            </Link>
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm py-3 rounded-lg transition-colors border border-green-200"
            >
              <Phone className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* ==========================================
            SECTION E: NEED ASSISTANCE?
        ========================================== */}
        <div className="bg-white mt-2">
          <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Need Assistance?
          </p>
          <AccountRow 
            href={isGuest ? getLoginHref("/account/support") : "/account/support"} 
            icon={<HelpCircle className="w-5 h-5 text-gray-600" />} 
            label="Help & Support" 
          />
        </div>

        {/* ==========================================
            SECTION F: MY iBUY ACCOUNT
        ========================================== */}
        <div className="bg-white mt-2">
          <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            My iBUY Account
          </p>
          <AccountRow href={isGuest ? getLoginHref("/account/orders") : "/account/orders"} icon={<Package className="w-5 h-5 text-gray-600" />} label="Orders" />
          <AccountRow href={isGuest ? getLoginHref("/account/inbox") : "/account/inbox"} icon={<Mail className="w-5 h-5 text-gray-600" />} label="Inbox" />
          <AccountRow href={isGuest ? getLoginHref("/account/reviews") : "/account/reviews"} icon={<Star className="w-5 h-5 text-gray-600" />} label="Ratings & Reviews" />
          <AccountRow href={isGuest ? getLoginHref("/account/vouchers") : "/account/vouchers"} icon={<Ticket className="w-5 h-5 text-gray-600" />} label="Vouchers" />
          <AccountRow href={isGuest ? getLoginHref("/account/wishlist") : "/account/wishlist"} icon={<Heart className="w-5 h-5 text-gray-600" />} label="Wishlist" />
          <AccountRow href={isGuest ? getLoginHref("/account/following") : "/account/following"} icon={<Store className="w-5 h-5 text-gray-600" />} label="Follow Seller" />
          <AccountRow href="/account/recently-viewed" icon={<History className="w-5 h-5 text-gray-600" />} label="Recently Viewed" />
        </div>

        {/* ==========================================
            SECTION G: MY SETTINGS
        ========================================== */}
        <div className="bg-white mt-2">
          <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            My Settings
          </p>
          <AccountRow href={isGuest ? getLoginHref("/account/addresses") : "/account/addresses"} icon={<MapPin className="w-5 h-5 text-gray-600" />} label="Address Book" />
          <AccountRow href={isGuest ? getLoginHref("/account/notifications") : "/account/notifications"} icon={<Bell className="w-5 h-5 text-gray-600" />} label="Notification Preferences" />
          <AccountRow href="/privacy-policy" icon={<ShieldAlert className="w-5 h-5 text-gray-600" />} label="Privacy Policy" />
        </div>

        {/* ==========================================
            SECTION H: LOGOUT (Authenticated Only)
        ========================================== */}
        {isAuthenticated && (
          <div className="mt-2 bg-white">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 text-red-600 font-semibold text-sm hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        )}

      </main>


    </div>
  );
}

// ==========================================
// Reusable Account Row Component
// ==========================================
function AccountRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between px-5 h-14 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </Link>
  );
}