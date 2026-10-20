"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { Star } from "lucide-react";

export default function ReviewsPage() {
  return (
    <AccountSubPageLayout title="Ratings & Reviews">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Star className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No reviews yet</h2>
        <p className="text-gray-500 mt-2">Share your thoughts on products you've purchased to help other customers.</p>
      </div>
    </AccountSubPageLayout>
  );
}