// src/app/seller/orders/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  ArrowLeft, Package, User, MapPin, Phone, Mail,
  Truck, CheckCircle, Clock, AlertCircle, Loader2,
  Save
} from "lucide-react";

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  status: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
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

const ITEM_STATUSES = [
  { value: "PENDING", label: "Pending", icon: Clock, color: "amber" },
  { value: "CONFIRMED", label: "Confirmed", icon: CheckCircle, color: "blue" },
  { value: "PROCESSING", label: "Processing", icon: Clock, color: "indigo" },
  { value: "SHIPPED", label: "Shipped", icon: Truck, color: "purple" },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle, color: "emerald" },
  { value: "CANCELLED", label: "Cancelled", icon: AlertCircle, color: "rose" },
];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { data: session, status } = useSession();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemUpdates, setItemUpdates] = useState<Record<string, {
    status?: string;
    trackingNumber?: string;
    trackingCarrier?: string;
  }>>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/seller/orders/${orderId}`);
    }
    if (status === "authenticated" && orderId) {
      fetchOrder();
    }
  }, [status, router, orderId]);

  const fetchOrder = async () => {
    try {
      const res = await fetch("/api/seller/orders?page=1&limit=100");
      const data = await res.json();
      if (res.ok) {
        const found = data.orders.find((o: Order) => o.id === orderId);
        if (found) {
          setOrder(found);
        } else {
          alert("Order not found or you don't have access to it.");
          router.push("/seller/orders");
        }
      }
    } catch (error) {
      console.error("Failed to fetch order", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (itemId: string) => {
    const updates = itemUpdates[itemId];
    if (!updates || Object.keys(updates).length === 0) {
      alert("No changes to save.");
      return;
    }

    setUpdatingItemId(itemId);
    try {
      const res = await fetch("/api/seller/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, ...updates }),
      });

      if (res.ok) {
        alert("Item updated successfully!");
        setExpandedItemId(null);
        setItemUpdates((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        fetchOrder(); // Refresh data
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update item");
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setUpdatingItemId(null);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">Order not found</h3>
        <button
          onClick={() => router.push("/seller/orders")}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/seller/orders"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Order #{order.id.slice(-8).toUpperCase()}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Customer & Shipping Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Customer
          </h3>
          <div className="space-y-2">
            <p className="text-base font-semibold text-gray-900">{order.customerName}</p>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              {order.customerEmail}
            </p>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              {order.customerPhone}
            </p>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Shipping Address
          </h3>
          <p className="text-sm text-gray-900 leading-relaxed">{order.shippingAddress}</p>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Items ({order.items.length})
          </h3>
          <div className="text-right">
            <p className="text-xs text-gray-500">Order Total</p>
            <p className="text-lg font-bold text-gray-900">GH₵ {order.totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {order.items.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const updates = itemUpdates[item.id] || {};

            return (
              <div key={item.id} className="p-5">
                {/* Item Header */}
                <div className="flex items-start gap-4">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusBadge(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-600">
                        Qty: <strong className="text-gray-900">{item.quantity}</strong>
                      </span>
                      <span className="text-gray-600">
                        Price: <strong className="text-gray-900">GH₵ {item.price.toFixed(2)}</strong>
                      </span>
                      <span className="text-gray-600">
                        Subtotal: <strong className="text-indigo-600">GH₵ {(item.price * item.quantity).toFixed(2)}</strong>
                      </span>
                    </div>

                    {/* Tracking Info (if shipped) */}
                    {item.trackingNumber && (
                      <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-xs text-purple-900">
                          <strong>Tracking:</strong> {item.trackingNumber}
                          {item.trackingCarrier && ` via ${item.trackingCarrier}`}
                        </p>
                      </div>
                    )}

                    {/* Action Button */}
                    {!isExpanded && item.status !== "DELIVERED" && item.status !== "CANCELLED" && (
                      <button
                        onClick={() => setExpandedItemId(item.id)}
                        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        Update Status & Tracking →
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Update Form */}
                {isExpanded && (
                  <div className="mt-4 ml-20 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    {/* Status Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Update Status
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ITEM_STATUSES.map((s) => {
                          const isSelected = (updates.status || item.status) === s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() =>
                                setItemUpdates((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], status: s.value },
                                }))
                              }
                              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <s.icon className="w-3.5 h-3.5" />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tracking Fields (only show if status is SHIPPED or DELIVERED) */}
                    {(updates.status === "SHIPPED" || item.status === "SHIPPED" || updates.status === "DELIVERED" || item.status === "DELIVERED") && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Tracking Number
                          </label>
                          <input
                            type="text"
                            value={updates.trackingNumber || item.trackingNumber || ""}
                            onChange={(e) =>
                              setItemUpdates((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], trackingNumber: e.target.value },
                              }))
                            }
                            placeholder="e.g., 1Z999AA10123456784"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Carrier
                          </label>
                          <input
                            type="text"
                            value={updates.trackingCarrier || item.trackingCarrier || ""}
                            onChange={(e) =>
                              setItemUpdates((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], trackingCarrier: e.target.value },
                              }))
                            }
                            placeholder="e.g., DHL, FedEx, Ghana Post"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleUpdateItem(item.id)}
                        disabled={updatingItemId === item.id || Object.keys(updates).length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {updatingItemId === item.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setExpandedItemId(null);
                          setItemUpdates((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                        }}
                        className="px-4 py-2 text-gray-700 text-sm font-medium hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}