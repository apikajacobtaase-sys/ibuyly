"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { Ticket } from "lucide-react";

export default function VouchersPage() {
  return (
    <AccountSubPageLayout title="Vouchers">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No vouchers available</h2>
        <p className="text-gray-500 mt-2">Your discount codes, store credit, and promotional vouchers will appear here.</p>
      </div>
    </AccountSubPageLayout>
  );
}