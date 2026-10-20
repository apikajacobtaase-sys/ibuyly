// src/app/seller/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Package, Clock, Truck, CheckCircle, XCircle, 
  Loader2, AlertCircle, ChevronRight, Filter
} from "lucide-react";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  status: string;
  imageUrl: string | null;
  sku: string;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  totalAmount: number;
  deliveryFee: number;
  paymentMethod: string | null;
  items: OrderItem[];
}

const STATUS_TABS = [
  { value: "ALL", label: "All", icon: Package },
  { value: "PENDING", label: "Pending", icon: Clock },
  { value: "PROCESSING", label: "Processing", icon: Clock },
  { value: "SHIPPED", label: "Shipped", icon: Truck },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

export default function SellerOrdersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/seller/orders");
    }
    if (status === "authenticated") {
      fetchOrders();
    }
  }, [status, router, activeTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (activeTab !== "ALL") params.set("itemStatus", activeTab);
      
      const res = await fetch(`/api/seller/orders?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setOrders(data.orders);
        setTotal(data.total);
      } else {
        console.error("Failed to fetch orders:", data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-800 border-amber-200",
      CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
      PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-200",
      SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
      DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
    };
    return styles[status] || styles.PENDING;
  };

  const getPrimaryItemStatus = (items: OrderItem[]) => {
    // Show the "worst" status (earliest in the pipeline)
    const priority = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    const statuses = items.map(i => i.status);
    for (const p of priority) {
      if (statuses.includes(p)) return p;
    }
    return "PENDING";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6" />
          Orders
          {total > 0 && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
              {total}
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage and fulfill customer orders
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">
            {activeTab === "ALL" ? "No orders yet" : `No ${activeTab.toLowerCase()} orders`}
          </h3>
          <p className="text-gray-500 mt-1">
            {activeTab === "ALL"
              ? "Orders containing your products will appear here."
              : `You don't have any orders with "${activeTab}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const primaryStatus = getPrimaryItemStatus(order.items);
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
            
            return (
              <Link
                key={order.id}
                href={`/seller/orders/${order.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all"
              >
                {/* Top Row: Order ID + Status */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Order</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono">
                      #{order.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(primaryStatus)}`}>
                    {primaryStatus.replace("_", " ")}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="mb-3 pb-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Items Preview */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((item, idx) => (
                      item.imageUrl ? (
                        <img
                          key={idx}
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg border-2 border-white object-cover"
                        />
                      ) : (
                        <div
                          key={idx}
                          className="w-10 h-10 rounded-lg border-2 border-white bg-gray-100 flex items-center justify-center"
                        >
                          <Package className="w-4 h-4 text-gray-400" />
                        </div>
                      )
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {order.items[0]?.title}
                      {order.items.length > 1 && ` +${order.items.length - 1} more`}
                    </p>
                    <p className="text-xs text-gray-500">{itemCount} item{itemCount > 1 ? "s" : ""}</p>
                  </div>
                </div>

                {/* Bottom Row: Total + Arrow */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-base font-bold text-gray-900">
                      GH₵ {order.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}