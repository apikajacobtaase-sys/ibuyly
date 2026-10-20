// src/app/account/notifications/MarkAllReadButton.tsx
"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MarkAllReadButton() {
  const router = useRouter();

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });
      // Refresh the page to update the UI and clear the badge in the header
      router.refresh(); 
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  return (
    <button
      onClick={handleMarkAllRead}
      className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
    >
      <CheckCheck className="w-4 h-4" />
      Mark all read
    </button>
  );
}