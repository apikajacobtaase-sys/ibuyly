// src/app/admin/orders/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, MapPin, CreditCard, Truck, Package, Store } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (params.id) fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`);
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
        setNewStatus(data.order.status);
      } else {
        router.push("/admin/orders");
      }
    } catch (error) {
      console.error("Failed to fetch order", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        alert("✅ Order status updated");
        fetchOrder();
      } else {
        alert("❌ Failed to update");
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Order #{order.id.slice(-8).toUpperCase()}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={order.status} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer, Shipping, Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Customer</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{order.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900 break-all">{order.customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{order.customer.phone || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Customer ID</p>
                <p className="font-mono text-xs text-gray-600">{order.customer.id.slice(-8)}</p>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Shipping Address</h3>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-medium text-gray-900">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.phone}</p>
                <p className="whitespace-pre-wrap">{order.shippingAddress.address}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.region}</p>
              </div>
            </div>
          )}

          {/* Items by Seller */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Order Items</h3>
            </div>
            <div className="space-y-6">
              {order.sellerGroups.map((group: any) => (
                <div key={group.sellerId} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-indigo-600" />
                      <p className="font-semibold text-gray-900 text-sm">{group.sellerName}</p>
                    </div>
                    <p className="font-semibold text-indigo-600 text-sm">
                      GH₵ {group.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">
                            SKU: {item.sku} • Qty: {item.quantity} × GH₵ {item.price.toFixed(2)}
                          </p>
                        </div>
                        <p className="font-medium text-gray-900 ml-3">
                          GH₵ {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Order Total</span>
              <span className="text-xl font-bold text-indigo-600">
                GH₵ {order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Payment, Shipment, Actions */}
        <div className="space-y-6">
          {/* Payment Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Payment</h3>
            </div>
            {order.payment ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Provider</p>
                  <p className="font-medium text-gray-900">{order.payment.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="font-medium text-gray-900">GH₵ {order.payment.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <StatusBadge status={order.payment.status} />
                </div>
                {order.payment.providerTransactionId && (
                  <div>
                    <p className="text-xs text-gray-500">Transaction ID</p>
                    <p className="font-mono text-xs text-gray-600 break-all">
                      {order.payment.providerTransactionId}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No payment record</p>
            )}
          </div>

          {/* Shipment Info */}
          {order.shipment && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Shipment</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Carrier</p>
                  <p className="font-medium text-gray-900">{order.shipment.carrier || "Not specified"}</p>
                </div>
                {order.shipment.trackingNumber && (
                  <div>
                    <p className="text-xs text-gray-500">Tracking</p>
                    <p className="font-mono text-xs text-gray-600">{order.shipment.trackingNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <StatusBadge status={order.shipment.status} />
                </div>
              </div>
            </div>
          )}

          {/* Status Update */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Update Status</h3>
            <div className="space-y-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REFUNDED">Refunded</option>
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={isUpdating || newStatus === order.status}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
                    {/* Refund Section */}
          {order.payment?.status === "SUCCESSFUL" && order.status !== "REFUNDED" && (
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <h3 className="font-semibold text-red-900 mb-4">💸 Refund Order</h3>
              <p className="text-xs text-gray-600 mb-3">
                This will attempt a Paystack refund and record the action in the financial ledger.
              </p>
              <button
                onClick={async () => {
                  if (!confirm("Are you sure you want to refund this order? This action is logged.")) return;
                  const reason = prompt("Reason for refund:") || "Admin-initiated refund";
                  try {
                    const res = await fetch(`/api/orders/${order.id}/refund`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(`✅ ${data.message}`);
                      fetchOrder();
                    } else {
                      alert(`❌ ${data.error}`);
                    }
                  } catch (error) {
                    alert("❌ Network error");
                  }
                }}
                className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Process Refund
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}