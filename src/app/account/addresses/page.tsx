// src/app/account/addresses/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MapPin, ArrowLeft, Plus } from "lucide-react";

export default function AddressesPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/account/addresses");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/account" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Address Book</h1>
        </div>
        <button className="p-2 text-orange-600 hover:bg-orange-50 rounded-full transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No saved addresses</h2>
          <p className="text-gray-500 mt-2 mb-6 max-w-sm mx-auto">
            Add a delivery address to make checkout faster and easier.
          </p>
          <button className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add New Address
          </button>
        </div>
      </div>
    </div>
  );
}