// src/components/AccountSubPage.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, LucideIcon } from "lucide-react";

interface AccountSubPageProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  actionHref?: string;
  children?: React.ReactNode;
}

export default function AccountSubPage({
  title,
  icon: Icon,
  iconColor = "text-gray-600",
  emptyTitle,
  emptyDescription,
  actionLabel,
  actionHref,
  children,
}: AccountSubPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Mobile Header with Back Button */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/account" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block max-w-4xl mx-auto px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h1>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {children || (
          <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className={`w-8 h-8 ${iconColor}`} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{emptyTitle}</h2>
            <p className="text-gray-500 mt-2 mb-6 max-w-sm mx-auto text-sm">
              {emptyDescription}
            </p>
            {actionLabel && actionHref && (
              <Link
                href={actionHref}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                {actionLabel}
              </Link>
            )}
          </div>
        )}
      </div>

    </div>
  );
}