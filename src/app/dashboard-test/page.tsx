"use client";

import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Settings,
  TrendingUp,
  Users,
  Store,
} from "lucide-react";
import { DashboardLayout, StatCard, StatusBadge, DataTable, SidebarItem } from "@/components/dashboard";

const sellerItems: SidebarItem[] = [
  { label: "Overview", href: "/dashboard-test", icon: LayoutDashboard },
  { label: "Products", href: "/dashboard-test/products", icon: Package, badge: 12 },
  { label: "Orders", href: "/dashboard-test/orders", icon: ShoppingCart, badge: 3 },
  { label: "Finances", href: "/dashboard-test/finances", icon: DollarSign },
  { label: "Analytics", href: "/dashboard-test/analytics", icon: TrendingUp },
  { label: "Settings", href: "/dashboard-test/settings", icon: Settings },
];

const sampleOrders = [
  { id: "1", customer: "John Doe", total: 450.00, status: "CONFIRMED", date: "2026-10-09" },
  { id: "2", customer: "Jane Smith", total: 1200.50, status: "PROCESSING", date: "2026-10-08" },
  { id: "3", customer: "Kwame Asante", total: 89.99, status: "SHIPPED", date: "2026-10-07" },
];

export default function DashboardTestPage() {
  return (
    <DashboardLayout
      sidebarItems={sellerItems}
      title="Seller Dashboard"
      logo="S"
      accentColor="bg-teal-600"
      pageTitle="Overview"
      pageSubtitle="Welcome back! Here's what's happening with your store."
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Sales"
          value="GH₵ 12,450.00"
          icon={DollarSign}
          color="text-green-600"
          bg="bg-green-100"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Orders"
          value={48}
          icon={ShoppingCart}
          color="text-blue-600"
          bg="bg-blue-100"
          subtitle="3 pending"
        />
        <StatCard
          title="Products"
          value={12}
          icon={Package}
          color="text-purple-600"
          bg="bg-purple-100"
          subtitle="2 low stock"
        />
        <StatCard
          title="Customers"
          value={156}
          icon={Users}
          color="text-orange-600"
          bg="bg-orange-100"
          trend={{ value: 5, isPositive: true }}
        />
      </div>

      {/* Status Badge Demo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Badges</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="PENDING" />
          <StatusBadge status="VERIFIED" />
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="PROCESSING" />
          <StatusBadge status="SHIPPED" />
          <StatusBadge status="DELIVERED" />
          <StatusBadge status="CANCELLED" />
          <StatusBadge status="REFUNDED" />
        </div>
      </div>

      {/* Data Table Demo */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
        <DataTable
          columns={[
            { key: "id", header: "Order ID" },
            { key: "customer", header: "Customer" },
            {
              key: "total",
              header: "Total",
              render: (item) => `GH₵ ${item.total.toFixed(2)}`,
            },
            {
              key: "status",
              header: "Status",
              render: (item) => <StatusBadge status={item.status} />,
            },
            {
              key: "date",
              header: "Date",
              hideOnMobile: true,
            },
          ]}
          data={sampleOrders}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => console.log("Clicked order:", item.id)}
        />
      </div>
    </DashboardLayout>
  );
}