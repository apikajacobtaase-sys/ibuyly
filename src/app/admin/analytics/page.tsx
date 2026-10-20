// src/app/admin/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, ShoppingCart, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/dashboard";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Failed to load analytics</div>;
  }

  const maxGMV = Math.max(...data.daily.map((d: any) => d.gmv), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Marketplace performance over the last 30 days</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="GMV (30 Days)"
          value={`GH₵ ${data.totals.gmv.toFixed(2)}`}
          icon={DollarSign}
          color="text-green-600"
          bg="bg-green-100"
        />
        <StatCard
          title="Platform Revenue"
          value={`GH₵ ${data.totals.revenue.toFixed(2)}`}
          icon={TrendingUp}
          color="text-indigo-600"
          bg="bg-indigo-100"
        />
        <StatCard
          title="Orders"
          value={data.totals.orders}
          icon={ShoppingCart}
          color="text-blue-600"
          bg="bg-blue-100"
        />
        <StatCard
          title="Avg Order Value"
          value={`GH₵ ${data.totals.avgOrderValue.toFixed(2)}`}
          icon={BarChart3}
          color="text-purple-600"
          bg="bg-purple-100"
        />
      </div>

      {/* GMV Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Daily GMV (Last 30 Days)</h3>
        <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
          {data.daily.map((day: any, idx: number) => {
            const height = (day.gmv / maxGMV) * 100;
            return (
              <div
                key={idx}
                className="flex-1 min-w-[8px] flex flex-col items-center group relative"
                title={`${day.date}: GH₵ ${day.gmv.toFixed(2)} (${day.orderCount} orders)`}
              >
                <div
                  className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t transition-colors"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{data.daily[0]?.date}</span>
          <span>{data.daily[data.daily.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sellers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Top Sellers by GMV</h3>
          </div>
          {data.topSellers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No seller data yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.topSellers.map((seller: any, idx: number) => {
                const maxRev = data.topSellers[0]?.revenue || 1;
                const percent = (seller.revenue / maxRev) * 100;
                return (
                  <div key={seller.sellerId} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">
                        #{idx + 1} {seller.businessName}
                      </p>
                      <span className="font-semibold text-indigo-600 text-sm ml-3">
                        GH₵ {seller.revenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Top Products by Revenue</h3>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No product data yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.topProducts.map((product: any, idx: number) => {
                const maxRev = data.topProducts[0]?.revenue || 1;
                const percent = (product.revenue / maxRev) * 100;
                return (
                  <div key={idx} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">
                        #{idx + 1} {product.title}
                      </p>
                      <span className="font-semibold text-indigo-600 text-sm ml-3">
                        GH₵ {product.revenue.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1.5">{product.quantity} units sold</p>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
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