"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAdminRole } from "@/hooks/usePermissions";
import type { SidebarItem } from "@/components/dashboard/Sidebar";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isAdmin, isSuperAdmin } = useAdminRole();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/");
    }
  }, [status, isAdmin, router]);

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const groups: SidebarItem[] = [
      {
        label: "Dashboard",
        iconName: "LayoutDashboard",
        children: [
          { label: "Overview", href: "/admin", iconName: "LayoutDashboard" },
          { label: "Analytics", href: "/admin/analytics", iconName: "BarChart3" },
        ],
      },
      {
        label: "People & Accounts",
        iconName: "Users",
        children: [
          { label: "Users", href: "/admin/users", iconName: "UserRound" },
          { label: "Customers", href: "/admin/customers", iconName: "Users" },
          { label: "Staff", href: "/admin/staff", iconName: "UserCog" },
        ],
      },
      {
        label: "Seller Management",
        iconName: "Store",
        children: [
          { label: "Sellers", href: "/admin/sellers", iconName: "Store" },
          { label: "Seller Invitations", href: "/admin/seller-invitations", iconName: "MailPlus" },
          { label: "Applications", href: "/admin/applications", iconName: "ClipboardList", highlight: true },
        ],
      },
      {
        label: "Catalogue",
        iconName: "Package",
        children: [
          { label: "Products", href: "/admin/products", iconName: "Package" },
          { label: "Categories", href: "/admin/categories", iconName: "FolderTree" },
          { label: "Promotions", href: "/admin/promotions", iconName: "Tag" },
          { label: "Reviews", href: "/admin/reviews", iconName: "Star" },
        ],
      },
      {
        label: "Sales & Finance",
        iconName: "Wallet",
        children: [
          { label: "Orders", href: "/admin/orders", iconName: "ShoppingCart" },
          { label: "Payments", href: "/admin/payments", iconName: "CreditCard" },
          { label: "Payouts", href: "/admin/payouts", iconName: "Wallet" },
        ],
      },
      {
        label: "Operations",
        iconName: "Truck",
        children: [
          { label: "Delivery & Logistics", href: "/admin/delivery", iconName: "Truck" },
          { label: "Locations", href: "/admin/locations", iconName: "Globe" },
          { label: "Disputes", href: "/admin/disputes", iconName: "AlertTriangle" },
          { label: "Support", href: "/admin/support", iconName: "LifeBuoy" },
        ],
      },
      {
        label: "Communication",
        iconName: "Mail",
        children: [
          { label: "Communications", href: "/admin/communications", iconName: "Mail" },
        ],
      },
      {
        label: "Security & Configuration",
        iconName: "ShieldCheck",
        children: [
          { label: "Audit Logs", href: "/admin/audit-logs", iconName: "ScrollText" },
          { label: "Settings", href: "/admin/settings", iconName: "Settings" },
        ],
      },
    ];

    const supportPages = [
      "/admin",
      "/admin/orders",
      "/admin/disputes",
      "/admin/support",
      "/admin/reviews",
    ];

    return groups
      .map((group) => {
        const visibleChildren = (group.children ?? []).filter((item) => {
          if (isSuperAdmin) return true;

          if (session?.user?.role === "SUPPORT") {
            return supportPages.includes(item.href ?? "");
          }

          if (isAdmin) {
            return item.href !== "/admin/staff";
          }

          return false;
        });

        return {
          ...group,
          children: visibleChildren,
        };
      })
      .filter((group) => (group.children?.length ?? 0) > 0);
  }, [isAdmin, isSuperAdmin, session]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <DashboardShell
      sidebarItems={sidebarItems}
      title="Admin Dashboard"
      logo="A"
      accentColor="bg-indigo-600"
    >
      {children}
    </DashboardShell>
  );
}