 // src/app/account/orders/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore"; // 👈 FIX 1: Added missing import
import OrderReviewForm from "@/components/OrderReviewForm";
import Link from "next/link";
import { 
  ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle,
  MapPin, CreditCard, Loader2, AlertCircle, Star, ShoppingCart
} from "lucide-react";

interface OrderItem {
  id: string;
  title: string;
  slug: string | null;
  productId: string | null;
  variantId: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  status: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  imageUrl: string | null;
  sku: string;
  sellerId: string | null;
  sellerName: string;
  offerId?: string | null; // ✅ Ensure this is present for Reorder
}
interface Order {
  id: string;
  status: string;
  paidAt: string | null;
  totalAmount: number;
  deliveryFee: number;
  subtotal: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  customerName: string;
  customerPhone: string;
  shippingAddress: {
    recipientName: string;
    phone: string;
    full: string;
  } | null;
  hasReviewableItems: boolean;
  hasExistingReview: boolean;
  items: OrderItem[];
}

const TIMELINE_STEPS = [
  { status: "PENDING", label: "Order Placed", icon: Clock, color: "amber" },
  { status: "CONFIRMED", label: "Confirmed", icon: CheckCircle, color: "blue" },
  { status: "PROCESSING", label: "Processing", icon: Package, color: "indigo" },
  { status: "SHIPPED", label: "Shipped", icon: Truck, color: "purple" },
  { status: "DELIVERED", label: "Delivered", icon: CheckCircle, color: "emerald" },
];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { data: session, status } = useSession();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/account/orders/${orderId}`);
    }
    if (status === "authenticated" && orderId) {
      fetchOrder();
    }
  }, [status, router, orderId]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/user/orders/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
      } else {
        alert("Order not found or you don't have access to it.");
        router.push("/account/orders");
      }
    } catch (error) {
      console.error("Failed to fetch order", error);
    } finally {
      setLoading(false);
    }
  };

  // Inside OrderDetailPage component in src/app/account/orders/[id]/page.tsx

const handleReorder = async () => {
  if (!order) return;
  
  const { addItem } = useCartStore.getState();
  
  for (const item of order.items) {
    // ✅ FIX: We need the offerId for reorder. 
    // If your API doesn't send it, you might need to fetch it or skip items without it.
    // For now, we'll use a placeholder or check if it exists in the item object.
    
    await addItem({
      productId: item.productId || "unknown",
      variantId: item.variantId || "unknown",
      offerId: item.offerId || null, // ⚠️ IMPORTANT: Ensure your API sends 'offerId' in the item
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      stockQuantity: 999,
      sellerId: item.sellerId || "unknown",
      sellerName: item.sellerName,
    });
  }

  alert(`✅ Added ${order.items.length} item(s) to your cart!`);
  router.push("/cart");
};

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "text-amber-600 bg-amber-100 border-amber-200",
      CONFIRMED: "text-blue-600 bg-blue-100 border-blue-200",
      PROCESSING: "text-indigo-600 bg-indigo-100 border-indigo-200",
      SHIPPED: "text-purple-600 bg-purple-100 border-purple-200",
      DELIVERED: "text-emerald-600 bg-emerald-100 border-emerald-200",
      CANCELLED: "text-rose-600 bg-rose-100 border-rose-200",
    };
    return colors[status] || colors.PENDING;
  };

  const getTimelineStepIndex = (status: string) => {
    const index = TIMELINE_STEPS.findIndex((step) => step.status === status);
    return index >= 0 ? index : 0;
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
          onClick={() => router.push("/account/orders")}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const currentStepIndex = getTimelineStepIndex(order.status);

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6 px-4">
      {/* Header */}
      <div>
        <Link
          href="/account/orders"
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
              {order.paidAt && new Date(order.paidAt).toLocaleDateString("en-GH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor(order.status)}`}>
            {order.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Tracking Timeline */}
      {order.status !== "CANCELLED" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Order Tracking
          </h3>
          
          <div className="relative">
            {TIMELINE_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const Icon = step.icon;
              
              return (
                <div key={step.status} className="relative flex items-start gap-4 pb-8 last:pb-0">
                  {/* Vertical Line */}
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div className={`absolute left-5 top-10 w-0.5 h-full ${
                      index < currentStepIndex ? "bg-emerald-500" : "bg-gray-200"
                    }`} />
                  )}
                  
                  {/* Icon Circle */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                    isCompleted
                      ? isCurrent
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white border-gray-300 text-gray-400"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pt-1.5">
                    <p className={`text-sm font-semibold ${
                      isCompleted ? "text-gray-900" : "text-gray-400"
                    }`}>
                      {step.label}
                    </p>
                    {isCurrent && step.status === "SHIPPED" && order.items[0]?.trackingNumber && (
                      <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-xs text-purple-900">
                          <strong>Tracking:</strong> {order.items[0].trackingNumber}
                          {order.items[0].trackingCarrier && ` via ${order.items[0].trackingCarrier}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Order Items ({order.items.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="p-6">
              <div className="flex items-start gap-4">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-20 h-20 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      {item.slug ? (
                        <Link href={`/products/${item.slug}`} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2">
                          {item.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Sold by: <span className="font-medium text-gray-700">{item.sellerName}</span>
                      </p>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusColor(item.status)}`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-gray-600">Qty: <strong className="text-gray-900">{item.quantity}</strong></span>
                    <span className="text-gray-600">Price: <strong className="text-gray-900">GH₵ {item.price.toFixed(2)}</strong></span>
                    <span className="text-gray-600">Subtotal: <strong className="text-indigo-600">GH₵ {item.subtotal.toFixed(2)}</strong></span>
                  </div>

                  {item.trackingNumber && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs text-purple-900">
                        <strong>Tracking:</strong> {item.trackingNumber}
                        {item.trackingCarrier && ` via ${item.trackingCarrier}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping & Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Shipping Address
          </h3>
          {order.shippingAddress ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">{order.shippingAddress.recipientName}</p>
              <p className="text-sm text-gray-600">{order.shippingAddress.phone}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{order.shippingAddress.full}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No address provided</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payment Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900 font-medium">GH₵ {order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-gray-900 font-medium">GH₵ {order.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className="text-lg font-bold text-indigo-600">GH₵ {order.totalAmount.toFixed(2)}</span>
            </div>
            {order.paymentMethod && (
              <p className="text-xs text-gray-500 pt-2">
                Paid via {order.paymentMethod}
                {order.paymentReference && ` (Ref: ${order.paymentReference})`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Review Section */}
      {order.hasReviewableItems && !order.hasExistingReview && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Leave a Review
            </h3>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {showReviewForm ? "Cancel" : "Write Review"}
            </button>
          </div>

          {showReviewForm && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                How was your experience? Your feedback helps other customers make better decisions.
              </p>
              {Array.from(new Set(order.items.map((i) => i.sellerId))).map((sellerId) => {
                const sellerName = order.items.find((i) => i.sellerId === sellerId)?.sellerName || "Seller";
                return (
                  <div key={sellerId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <OrderReviewForm
                      orderId={order.id}
                      sellerId={sellerId!}
                      sellerName={sellerName}
                      onSuccess={() => fetchOrder()}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {order.hasExistingReview && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <p className="text-sm text-emerald-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            You have already reviewed this order. Thank you for your feedback!
          </p>
        </div>
      )}

      {/* Reorder Section */}
      {order.status === "DELIVERED" && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                🔄 Loved your order?
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Add all {order.items.length} item{order.items.length > 1 ? "s" : ""} back to your cart with one click.
              </p>
            </div>
            <button
              onClick={handleReorder}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <ShoppingCart className="w-4 h-4" />
              Reorder All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}