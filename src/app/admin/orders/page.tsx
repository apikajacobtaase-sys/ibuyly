// src/app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package, Search, Loader2, ChevronLeft, ChevronRight, Truck, MapPin, Phone } from "lucide-react";

interface Order {
  id: string;
  createdAt: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  location: string;
  overallStatus: string;
  itemCount: number;
  items: {
    id: string;
    title: string;
    sellerName: string;
    status: string;
    trackingNumber: string | null;
    trackingCarrier: string | null;
  }[];
}

const STATUS_TABS = [
  { value: "ALL", label: "All Orders" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const currentStatus = searchParams.get("status") || "ALL";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const searchQuery = searchParams.get("q") || "";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/admin/orders");
    if (status === "authenticated") fetchOrders();
  }, [status, router, currentStatus, currentPage, searchQuery]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (currentStatus !== "ALL") params.set("status", currentStatus);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") params.delete("status");
    else params.set("status", status);
    params.set("page", "1");
    router.push(`/admin/orders?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.set("page", "1");
    router.push(`/admin/orders?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/orders?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-200",
      SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
      DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
    };
    return styles[status] || styles.PROCESSING;
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[400px]"><Loader2 className="w-8 h-8 text-slate-800 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7" />
          Order Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">Track deliveries, view tracking numbers, and manage customer orders.</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by Order ID, customer name, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </form>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabClick(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              currentStatus === tab.value ? "bg-slate-800 text-white shadow-sm" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Order Header */}
              <div 
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {order.itemCount} item(s)</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
                    <p className="text-xs text-gray-500 flex items-center justify-end gap-1"><MapPin className="w-3 h-3" /> {order.location || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">GH₵ {order.totalAmount.toFixed(2)}</p>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border mt-1 ${getStatusBadge(order.overallStatus)}`}>
                      {order.overallStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Order Details */}
              {expandedOrderId === order.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Customer Details</h4>
                      <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5" /> {order.customerPhone}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1"><MapPin className="w-3.5 h-3.5" /> {order.location}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Item Delivery Status</h4>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-gray-200">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                              <p className="text-xs text-gray-500">Seller: {item.sellerName}</p>
                              {item.trackingNumber && (
                                <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                                  <Truck className="w-3 h-3" /> {item.trackingNumber} {item.trackingCarrier ? `via ${item.trackingCarrier}` : ""}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0 ${getStatusBadge(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}