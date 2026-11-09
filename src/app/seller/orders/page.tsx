// src/app/seller/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Package, Clock, Truck, CheckCircle, XCircle,
  Loader2, AlertCircle, ChevronRight, Filter, Phone, MapPin
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
  sellerSubtotal: number;
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
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [confirmationFeedback, setConfirmationFeedback] = useState<{
    orderId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  const handleQuickConfirm = async (order: Order) => {
    const pendingItems = order.items.filter(
      (item) => item.status === "PENDING"
    );

    if (pendingItems.length !== 1) return;

    setConfirmingOrderId(order.id);
    setConfirmationFeedback(null);

    try {
      const response = await fetch("/api/seller/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: pendingItems[0].id,
          status: "CONFIRMED",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setConfirmationFeedback({
          orderId: order.id,
          type: "error",
          message: data.error || "Could not confirm this order. Please try again.",
        });
        return;
      }

      setConfirmationFeedback({
        orderId: order.id,
        type: "success",
        message: "Order confirmed successfully.",
      });

      await fetchOrders();
    } catch (error) {
      console.error("Quick confirmation failed:", error);
      setConfirmationFeedback({
        orderId: order.id,
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setConfirmingOrderId(null);
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
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
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
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
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
        <div className="space-y-3 sm:space-y-4">
          {orders.map((order) => {
            const primaryStatus = getPrimaryItemStatus(order.items);
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

            const statusCounts = order.items.reduce(
              (counts, item) => {
                const itemStatus = item.status as keyof typeof counts;

                if (itemStatus in counts) {
                  counts[itemStatus] += item.quantity;
                }

                return counts;
              },
              {
                PENDING: 0,
                CONFIRMED: 0,
                PROCESSING: 0,
                SHIPPED: 0,
                DELIVERED: 0,
                CANCELLED: 0,
              }
            );

            return (
              <div key={order.id} className="min-w-0">
                <Link
                href={`/seller/orders/${order.id}`}
                className={`block min-w-0 rounded-xl border p-3.5 sm:p-4 transition-all hover:shadow-md ${statusCounts.PENDING > 0 ? "border-amber-300 bg-amber-50/40 active:bg-amber-50" : "border-gray-200 bg-white active:bg-gray-50 hover:border-indigo-300"}`}
              >
                {/* Top Row: Order ID + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
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

                {/* Fulfilment Breakdown */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["PENDING", "Pending"],
                      ["CONFIRMED", "Confirmed"],
                      ["PROCESSING", "Processing"],
                      ["SHIPPED", "Shipped"],
                      ["DELIVERED", "Delivered"],
                      ["CANCELLED", "Cancelled"],
                    ] as const
                  ).map(([key, label]) =>
                    statusCounts[key] > 0 ? (
                      <span
                        key={key}
                        className={`rounded-full border px-2 py-1 text-[11px] font-medium ${getStatusBadge(key)}`}
                      >
                        {label}: {statusCounts[key]}
                      </span>
                    ) : null
                  )}
                </div>

                {/* Customer Info */}
                <div className="mb-3 pb-3 border-b border-gray-100 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{order.customerName}</p>
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

                  {order.customerPhone && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a href={`tel:${order.customerPhone}`} className="min-h-8 inline-flex items-center underline underline-offset-2 hover:text-indigo-700" onClick={(event) => event.stopPropagation()}>{order.customerPhone}</a>
                    </p>
                  )}
                  {order.shippingAddress && order.shippingAddress !== "No address provided" && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-600">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="line-clamp-2">{order.shippingAddress}</span>
                    </p>
                  )}
                {/* Items Preview */}
                <div className="flex min-w-0 items-center gap-3 mb-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((item, idx) => (
                      item.imageUrl ? (
                        <img
                          key={idx}
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-11 h-11 shrink-0 rounded-lg border-2 border-white object-cover"
                        />
                      ) : (
                        <div
                          key={idx}
                          className="w-11 h-11 shrink-0 rounded-lg border-2 border-white bg-gray-100 flex items-center justify-center"
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
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Your Items Subtotal</p>
                    <p className="text-lg font-bold text-gray-900">
                      GHâ‚µ {order.sellerSubtotal.toFixed(2)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>

              {order.items.filter((item) => item.status === "PENDING").length === 1 && (
                <button
                  type="button"
                  onClick={() => handleQuickConfirm(order)}
                  disabled={confirmingOrderId === order.id}
                  className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmingOrderId === order.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Confirm Pending Item
                    </>
                  )}
                </button>
              )}

              {confirmationFeedback && confirmationFeedback.orderId === order.id && (
                <p
                  role="status"
                  aria-live="polite"
                  className={confirmationFeedback.type === "success"
                    ? "mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                    : "mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700"}
                >
                  {confirmationFeedback.message}
                </p>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
