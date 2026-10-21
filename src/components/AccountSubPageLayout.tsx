 // src/components/AccountSubPageLayout.tsx
"use client";

export default function AccountSubPageLayout({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode 
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Title Only */}
      <div className="hidden md:block max-w-4xl mx-auto px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Mobile Title (Simple, no back button) */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-[57px] z-20">
        <h1 className="text-lg font-bold text-gray-900 text-center">{title}</h1>
      </div>

      {children}
    </div>
  );
}