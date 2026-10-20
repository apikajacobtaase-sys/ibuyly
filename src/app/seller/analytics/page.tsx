// src/app/seller/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Package, ShoppingCart, DollarSign } from "lucide-react";
import { StatCard } from "@/components/dashboard";

interface AnalyticsData {
  dailySales: Array<{ date: string; sales: number; orderCount: number }>;
  statusBreakdown: Record<string, number>;
  topProducts: Array<{ title: string; quantity: number; revenue: number }>;
  summary: {
    totalRevenue: number;
    totalUnitsSold: number;
    totalOrders: number;
    avgOrderValue: number;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/seller/analytics");
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Failed to load analytics</div>;
  }

  // Calculate max sales for chart scaling
  const maxDailySales = Math.max(...data.dailySales.map((d) => d.sales), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Performance overview for the last 30 days</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={`GH₵ ${data.summary.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="text-green-600"
          bg="bg-green-100"
        />
        <StatCard
          title="Orders"
          value={data.summary.totalOrders}
          icon={ShoppingCart}
          color="text-blue-600"
          bg="bg-blue-100"
        />
        <StatCard
          title="Units Sold"
          value={data.summary.totalUnitsSold}
          icon={Package}
          color="text-purple-600"
          bg="bg-purple-100"
        />
        <StatCard
          title="Avg Order Value"
          value={`GH₵ ${data.summary.avgOrderValue.toFixed(2)}`}
          icon={TrendingUp}
          color="text-teal-600"
          bg="bg-teal-100"
        />
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Daily Sales (Last 30 Days)</h3>
        <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
          {data.dailySales.map((day, idx) => {
            const height = (day.sales / maxDailySales) * 100;
            return (
              <div
                key={idx}
                className="flex-1 min-w-[8px] flex flex-col items-center group relative"
                title={`${day.date}: GH₵ ${day.sales.toFixed(2)} (${day.orderCount} orders)`}
              >
                <div className="w-full bg-teal-500 hover:bg-teal-600 rounded-t transition-colors"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{data.dailySales[0]?.date}</span>
          <span>{data.dailySales[data.dailySales.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Top Products by Revenue</h3>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No sales data yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.topProducts.map((product, idx) => {
                const maxRevenue = data.topProducts[0]?.revenue || 1;
                const percent = (product.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">
                        #{idx + 1} {product.title}
                      </p>
                      <span className="font-semibold text-teal-600 text-sm ml-3">
                        GH₵ {product.revenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{product.quantity} units sold</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Status Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Orders by Status</h3>
          </div>
          {Object.keys(data.statusBreakdown).length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No orders yet</div>
          ) : (
            <div className="p-6 space-y-3">
              {Object.entries(data.statusBreakdown).map(([status, count]) => {
                const total = Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0);
                const percent = (count / total) * 100;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {status.toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-gray-600">
                        {count} ({percent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}