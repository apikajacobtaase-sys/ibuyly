// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Store,
  Package,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  Calendar,
  DollarSign,
} from "lucide-react";

interface Summary {
  gmv: number;
  platformRevenue: number;
  totalOrders: number;
  todayOrders: number;
  monthOrders: number;
  totalCustomers: number;
  totalSellers: number;
  pendingSellers: number;
  activeProducts: number;
}

interface RevenueDay {
  date: string;
  revenue: number;
  orders: number;
}

interface TopSeller {
  sellerId: string;
  businessName: string;
  revenue: number;
  orders: number;
}

interface LowStockItem {
  id: string;
  sku: string;
  stockQuantity: number;
  productTitle: string;
  productSlug: string;
  sellerName: string;
}

interface RecentOrder {
  id: string;
  status: string;
  paidAt: string | null;
  totalAmount: number;
  customerName: string;
  itemCount: number;
  primaryImage: string | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenueChart, setRevenueChart] = useState<RevenueDay[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin");
    }
    if (status === "authenticated") {
      fetchMetrics();
    }
  }, [status, router]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/admin/metrics");
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setRevenueChart(data.revenueChart || []);
        setTopSellers(data.topSellers || []);
        setLowStock(data.lowStock || []);
        setRecentOrders(data.recentOrders || []);
      } else {
        console.error("Failed to fetch metrics:", data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (loading || !summary) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
      </div>
    );
  }

  // Calculate max revenue for chart scaling
  const maxRevenue = Math.max(...revenueChart.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Platform Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your marketplace performance
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total GMV"
          value={formatCurrency(summary.gmv)}
          icon={DollarSign}
          color="emerald"
          subtitle={`${summary.todayOrders} orders today`}
        />
        <MetricCard
          label="Platform Revenue"
          value={formatCurrency(summary.platformRevenue)}
          icon={TrendingUp}
          color="indigo"
          subtitle={`${summary.monthOrders} orders this month`}
        />
        <MetricCard
          label="Total Orders"
          value={formatNumber(summary.totalOrders)}
          icon={Package}
          color="blue"
          subtitle="All time"
        />
        <MetricCard
          label="Active Products"
          value={formatNumber(summary.activeProducts)}
          icon={ShoppingBag}
          color="amber"
          subtitle={`Across ${summary.totalSellers} sellers`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniMetricCard
          label="Customers"
          value={formatNumber(summary.totalCustomers)}
          icon={Users}
        />
        <MiniMetricCard
          label="Sellers"
          value={formatNumber(summary.totalSellers)}
          icon={Store}
        />
        <MiniMetricCard
          label="Pending Sellers"
          value={formatNumber(summary.pendingSellers)}
          icon={AlertTriangle}
          highlight={summary.pendingSellers > 0}
        />
        <MiniMetricCard
          label="Low Stock Alerts"
          value={formatNumber(lowStock.length)}
          icon={AlertTriangle}
          highlight={lowStock.length > 0}
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              Revenue — Last 30 Days
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Daily gross merchandise value
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-[2px] sm:gap-1 h-40 sm:h-56 border-b border-l border-gray-200 pl-2 pb-1">
          {revenueChart.map((day, idx) => {
            const height = (day.revenue / maxRevenue) * 100;
            const date = new Date(day.date);
            const dayLabel = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center group relative"
                title={`${dayLabel}: ${formatCurrency(day.revenue)} (${day.orders} orders)`}
              >
                <div
                  className={`w-full rounded-t transition-all ${
                    day.revenue > 0
                      ? "bg-gradient-to-t from-indigo-600 to-indigo-400 hover:from-indigo-700 hover:to-indigo-500"
                      : "bg-gray-100"
                  }`}
                  style={{ height: `${Math.max(height, day.revenue > 0 ? 2 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
          <span>
            {new Date(revenueChart[0]?.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>
            {new Date(
              revenueChart[revenueChart.length - 1]?.date
            ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      {/* Two-Column Layout: Top Sellers + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Sellers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Top Sellers
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">By revenue (all time)</p>
          </div>
          {topSellers.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No seller revenue yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topSellers.map((seller, idx) => (
                <div key={seller.sellerId} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {seller.businessName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {seller.orders} order{seller.orders !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(seller.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Low Stock Alerts
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Products running low</p>
          </div>
          {lowStock.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              All products are well-stocked. 🎉
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {lowStock.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.productTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.sellerName} • SKU: {item.sku}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                    {item.stockQuantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Recent Orders
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest 10 paid orders</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No orders yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Order</th>
                  <th className="px-5 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-5 py-2.5 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {order.primaryImage ? (
                          <img
                            src={order.primaryImage}
                            alt=""
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-mono text-xs text-gray-700">
                          #{order.id.slice(-8).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {order.customerName}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">
                      {order.paidAt
                        ? new Date(order.paidAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Sub-components
// ==========================================

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: any;
  color: "emerald" | "indigo" | "blue" | "amber";
  subtitle: string;
}) {
  const colors = {
    emerald: "from-emerald-500 to-emerald-700 text-emerald-600 bg-emerald-50",
    indigo: "from-indigo-500 to-indigo-700 text-indigo-600 bg-indigo-50",
    blue: "from-blue-500 to-blue-700 text-blue-600 bg-blue-50",
    amber: "from-amber-500 to-amber-700 text-amber-600 bg-amber-50",
  };
  const [gradient, textColor, bgColor] = colors[color].split(" text-");
  const iconBg = `${bgColor} ${textColor}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function MiniMetricCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: any;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`w-4 h-4 ${highlight ? "text-amber-600" : "text-gray-400"}`}
        />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p
        className={`text-xl font-bold ${
          highlight ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-800", // 👈 ADD THIS LINE
    PENDING: "bg-amber-100 text-amber-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
        styles[status] || styles.PENDING
      }`}
    >
      {status}
    </span>
  );
}