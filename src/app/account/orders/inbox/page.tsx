"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { Mail } from "lucide-react";

export default function InboxPage() {
  return (
    <AccountSubPageLayout title="Inbox">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Your inbox is empty</h2>
        <p className="text-gray-500 mt-2">Messages, order updates, and promotions will appear here.</p>
      </div>
    </AccountSubPageLayout>
  );
}