// src/app/seller/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Clock,
} from "lucide-react";

interface Summary {
  grossRevenue: number;
  netEarnings: number;
  totalOrders: number;
  avgOrderValue: number;
  pendingOrders: number;
  commissionRate: number;
}

interface RevenueDay {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: string;
  title: string;
  slug: string;
  unitsSold: number;
  revenue: number;
}

interface LowStockItem {
  id: string;
  sku: string;
  stockQuantity: number;
  productTitle: string;
  productSlug: string;
}

export default function SellerDashboardPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenueChart, setRevenueChart] = useState<RevenueDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/seller/dashboard");
    }
    if (status === "authenticated") {
      fetchMetrics();
    }
  }, [status, router]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/seller/metrics");
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setRevenueChart(data.revenueChart || []);
        setTopProducts(data.topProducts || []);
        setLowStock(data.lowStock || []);
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
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const maxRevenue = Math.max(...revenueChart.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Seller Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your store performance
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Gross Revenue"
          value={formatCurrency(summary.grossRevenue)}
          icon={DollarSign}
          color="emerald"
          subtitle={`Net: ${formatCurrency(summary.netEarnings)}`}
        />
        <MetricCard
          label="Total Orders"
          value={formatNumber(summary.totalOrders)}
          icon={ShoppingBag}
          color="blue"
          subtitle={`Avg: ${formatCurrency(summary.avgOrderValue)}`}
        />
        <MetricCard
          label="Pending Orders"
          value={formatNumber(summary.pendingOrders)}
          icon={Clock}
          color="amber"
          subtitle="Needs attention"
        />
        <MetricCard
          label="Platform Fee"
          value={`${summary.commissionRate}%`}
          icon={TrendingUp}
          color="indigo"
          subtitle="Per order commission"
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

      {/* Two-Column Layout: Top Products + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Top Selling Products
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">By revenue (all time)</p>
            </div>
            <Link
              href="/seller/products"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No sales yet. Start promoting your products!
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topProducts.map((product, idx) => (
                <Link 
                  key={product.id} 
                  href={`/products/${product.slug}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.unitsSold} units sold
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(product.revenue)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Low Stock Alerts
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Products running low</p>
            </div>
            <Link
              href="/seller/products"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              All your products are well-stocked! 🎉
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {lowStock.map((item) => (
                <Link
                  key={item.id}
                  href={`/seller/products/edit?slug=${item.productSlug}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.productTitle}
                    </p>
                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                    {item.stockQuantity} left
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
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