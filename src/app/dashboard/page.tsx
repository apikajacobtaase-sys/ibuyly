"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-600">
              iBUY Dashboard
            </h1>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
            >
              Sign Out
            </button>
            <Link href="/orders" className="block mt-4 w-full text-center bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition">
  📦 View My Order History
</Link>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-green-800 mb-3">
              ✅ Authentication Working!
            </h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>Name:</strong> {session?.user?.name}</p>
              <p><strong>Email:</strong> {session?.user?.email}</p>
              <p><strong>Role:</strong> <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-sm font-medium">{session?.user?.role}</span></p>
              <p><strong>User ID:</strong> {session?.user?.id}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            🚀 What&apos;s Next?
          </h2>
          <ul className="space-y-3 text-gray-600">
            <li>✅ Database & Schema (Step 1)</li>
            <li>✅ Authentication System (Step 2)</li>
            <li className="text-indigo-600 font-medium">⏳ Step 3: Seller Dashboard & Product Management</li>
            <li>⏳ Step 4: AI Concierge (The iBUY Brain)</li>
            <li>⏳ Step 5: Shopping Cart & Checkout</li>
            <li>⏳ Step 6: Payments (Paystack/MoMo)</li>
          </ul>
          
          <Link 
            href="/seller" 
            className="block mt-6 w-full text-center bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Go to Seller Dashboard →
          </Link>
          <Link 
  href="/concierge" 
  className="block mt-4 w-full text-center bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
>
  ✨ Talk to the AI Concierge
</Link>
        </div>
      </div>
    </div>
  );
}