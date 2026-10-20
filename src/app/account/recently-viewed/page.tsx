"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { History } from "lucide-react";

export default function RecentlyViewedPage() {
  return (
    <AccountSubPageLayout title="Recently Viewed">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No recently viewed items</h2>
        <p className="text-gray-500 mt-2">Products you browse will automatically appear here for easy access.</p>
      </div>
    </AccountSubPageLayout>
  );
}