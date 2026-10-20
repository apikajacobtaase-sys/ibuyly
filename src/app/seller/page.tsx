// src/app/seller/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { StatCard, StatusBadge } from "@/components/dashboard";

interface SellerStats {
  totalSales: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  lowStockProducts: Array<{
    variantId: string;
    productTitle: string;
    productSlug: string;
    stockQuantity: number;
    threshold: number;
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    createdAt: string;
    itemCount: number;
    subtotal: number;
  }>;
  bestProducts: Array<{
    title: string;
    quantity: number;
    revenue: number;
  }>;
}

export default function SellerOverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSellerProfile, setHasSellerProfile] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchStats();
    }
  }, [status]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/seller/stats");
      if (res.status === 404) {
        setHasSellerProfile(false);
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!hasSellerProfile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Package className="w-10 h-10 text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Become a Seller</h2>
        <p className="text-gray-600 mb-8">
          You don&apos;t have a seller profile yet. Apply to start selling on iBUY and reach thousands of customers across Ghana.
        </p>
        <button className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition">
          Apply to Become a Seller
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(" ")[0] || "Seller"}! 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition self-start"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sales"
          value={`GH₵ ${stats.totalSales.toFixed(2)}`}
          icon={DollarSign}
          color="text-green-600"
          bg="bg-green-100"
          subtitle={`${stats.totalOrders} orders total`}
        />
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders}
          icon={ShoppingCart}
          color="text-orange-600"
          bg="bg-orange-100"
          subtitle="Needs fulfillment"
        />
        <StatCard
          title="Active Products"
          value={`${stats.activeProducts} / ${stats.totalProducts}`}
          icon={Package}
          color="text-teal-600"
          bg="bg-teal-100"
          subtitle={`${stats.draftProducts} drafts`}
        />
        <StatCard
          title="Low Stock Alerts"
          value={stats.lowStockProducts.length}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-100"
          subtitle="Products need restocking"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders - 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Orders</h3>
            <Link href="/seller/orders" className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-gray-500 truncate">{order.id}</p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} •{" "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-semibold text-gray-900 text-sm">
                      GH₵ {order.subtotal.toFixed(2)}
                    </span>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Best Performing Products */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-gray-900">Best Sellers</h3>
            </div>
            {stats.bestProducts.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No sales data yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.bestProducts.map((product, idx) => (
                  <div key={idx} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">
                        {product.title}
                      </p>
                      <span className="text-xs text-gray-500 ml-2">
                        {product.quantity} sold
                      </span>
                    </div>
                    <p className="text-xs text-teal-600 font-semibold mt-0.5">
                      GH₵ {product.revenue.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-900">Low Stock</h3>
              </div>
              <Link href="/seller/inventory" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                Manage
              </Link>
            </div>
            {stats.lowStockProducts.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                All products well-stocked ✓
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.lowStockProducts.map((item) => (
                  <div key={item.variantId} className="px-6 py-3">
                    <Link href={`/products/${item.productSlug}`} className="text-sm font-medium text-gray-900 hover:text-teal-600 block truncate">
                      {item.productTitle}
                    </Link>
                    <p className="text-xs text-red-600 mt-0.5">
                      Only {item.stockQuantity} left (threshold: {item.threshold})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}