"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { Store } from "lucide-react";

export default function FollowingPage() {
  return (
    <AccountSubPageLayout title="Followed Sellers">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-purple-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Not following any sellers yet</h2>
        <p className="text-gray-500 mt-2">Follow your favorite stores to get updates on their new arrivals and sales.</p>
      </div>
    </AccountSubPageLayout>
  );
}