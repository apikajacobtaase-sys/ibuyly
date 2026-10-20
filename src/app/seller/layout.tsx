 // src/app/seller/layout.tsx
import Sidebar from "@/components/dashboard/Sidebar";
import { sellerSidebarItems } from "@/lib/sellerSidebar";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 👇 This passes the items array to the Sidebar component */}
      <Sidebar
        items={sellerSidebarItems}
        title="Seller Dashboard"
        logo="S"
        accentColor="bg-teal-600"
      />
      
      {/* 👇 This is where your actual seller pages will render */}
      <main className="flex-1 p-4 sm:p-6 min-w-0 lg:ml-0">
        {children}
      </main>
    </div>
  );
}