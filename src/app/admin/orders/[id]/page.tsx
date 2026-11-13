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
 const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  useEffect(() => {
    if (params.id) fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`);
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
      } else {
        router.push("/admin/orders");
      }
    } catch (error) {
      console.error("Failed to fetch order", error);
    } finally {
      setIsLoading(false);
    }
  };

const reconcileRefund = async (refundId: string) => {
  if (!confirm("Check Paystack and reconcile this refund?")) return;

  setReconcilingId(refundId);

  try {
    const res = await fetch(`/api/admin/refunds/${refundId}/reconcile`, {
      method: "POST",
    });

    const data = await res.json();

    if (res.ok) {
      alert(`Refund status: ${data.status}`);
    } else {
      alert(data.error || data.message || "Reconciliation failed.");
    }

    await fetchOrder();
  } catch (error) {
    console.error("Refund reconciliation failed:", error);
    alert("Network error during reconciliation.");
  } finally {
    setReconcilingId(null);
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
                      GHâ‚µ {group.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-3">
  {group.items.map((item: any) => (
    <div key={item.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <div className="flex justify-between items-start gap-3 text-sm">
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium">{item.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            SKU: {item.sku} • Qty: {item.quantity} × GH₵ {item.price.toFixed(2)}
          </p>
        </div>
        <p className="font-medium text-gray-900 whitespace-nowrap">
          GH₵ {(item.price * item.quantity).toFixed(2)}
        </p>
      </div>

      <div className="mt-2">
        <StatusBadge status={item.status} />
      </div>

      {(item.trackingNumber || item.trackingCarrier || item.shippedAt || item.deliveredAt) && (
        <div className="mt-2 p-3 rounded-lg bg-purple-50 border border-purple-100 space-y-1">
          {item.trackingCarrier && (
            <p className="text-xs text-purple-900">
              <strong>Carrier:</strong> {item.trackingCarrier}
            </p>
          )}
          {item.trackingNumber && (
            <p className="text-xs text-purple-900 break-all">
              <strong>Tracking number:</strong> {item.trackingNumber}
            </p>
          )}
          {item.shippedAt && (
            <p className="text-xs text-purple-900">
              <strong>Shipped:</strong> {new Date(item.shippedAt).toLocaleString()}
            </p>
          )}
          {item.deliveredAt && (
            <p className="text-xs text-emerald-700">
              <strong>Delivered:</strong> {new Date(item.deliveredAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  ))}
</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Order Total</span>
              <span className="text-xl font-bold text-indigo-600">
                GHâ‚µ {order.totalAmount.toFixed(2)}
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
                  <p className="font-medium text-gray-900">GHâ‚µ {order.payment.amount.toFixed(2)}</p>
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
          {/* Refund History */}
{order.refundOperations?.length > 0 && (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <h3 className="font-semibold text-gray-900 mb-4">
      Refund History
    </h3>

    <div className="space-y-4">
      {order.refundOperations.map((refund: any) => (
        <div
          key={refund.id}
          className="border border-gray-100 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900">
              {refund.currency} {refund.amount.toFixed(2)}
            </span>
            <StatusBadge status={refund.status} />
          </div>

          <p className="text-sm text-gray-600">
            {refund.reason}
          </p>

          <p className="text-xs text-gray-500">
            Initiated: {new Date(refund.createdAt).toLocaleString()}
          </p>

          {refund.completedAt && (
            <p className="text-xs text-emerald-700">
              Completed: {new Date(refund.completedAt).toLocaleString()}
            </p>
          )}

          {refund.providerReference && (
            <p className="text-xs text-gray-500 break-all">
              Paystack reference: {refund.providerReference}
            </p>
          )}

          {refund.status === "REQUIRES_RECONCILIATION" && (
            <button
              onClick={() => reconcileRefund(refund.id)}
              disabled={reconcilingId === refund.id}
              className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {reconcilingId === refund.id
                ? "Reconciling..."
                : "Reconcile Refund"}
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
)}
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

          {/* Order Status */}
<div className="bg-white rounded-xl border border-gray-200 p-6">
  <h3 className="font-semibold text-gray-900 mb-4">
    Overall Order Status
  </h3>

  <StatusBadge status={order.status} size="md" />

  <p className="text-xs text-gray-500 mt-3">
    Order status is automatically synchronized with payment and
    seller fulfilment updates. Individual item statuses are managed
    by their respective sellers.
  </p>
</div>
   {/* Refund Section */}
          {order.payment?.status === "SUCCESSFUL" && order.status !== "REFUNDED" && (
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <h3 className="font-semibold text-red-900 mb-4">ðŸ’¸ Refund Order</h3>
              <p className="text-xs text-gray-600 mb-3">
                This will attempt a Paystack refund and record the action in the financial ledger.
              </p>
              <button
                onClick={async () => {
                  if (!confirm("Are you sure you want to refund this order? This action is logged.")) return;
                  const reason = prompt("Reason for refund:") || "Admin-initiated refund";
                  const storageKey = `ibuy-admin-refund:${order.id}`;
let idempotencyKey = localStorage.getItem(storageKey);

if (!idempotencyKey) {
  idempotencyKey = crypto.randomUUID();
  localStorage.setItem(storageKey, idempotencyKey);
}
                  try {
                    const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
                      method: "POST",
                       headers: {
  "Content-Type": "application/json",
  "Idempotency-Key": idempotencyKey,
},
                      body: JSON.stringify({ reason, idempotencyKey }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(`âœ… ${data.message}`);
                      fetchOrder();
                    } else {
                      alert(`âŒ ${data.error}`);
                    }
                  } catch (error) {
                    alert("âŒ Network error");
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
