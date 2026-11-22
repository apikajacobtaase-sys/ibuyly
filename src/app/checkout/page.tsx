 "use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShoppingBag,
  MapPin,
  CreditCard,
  PackageCheck,
  ChevronRight,
  LockKeyhole,
  Truck,
  Tag,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import DeliveryAddressForm from "@/components/checkout/DeliveryAddressForm";
import PromoCodeInput from "@/components/PromoCodeInput";
import { useSession } from "next-auth/react";

export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();

  const {
    selectedItems,
    selectedTotalAmount,
    clearCart,
    syncFromDB,
  } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
const [paymentMethod, setPaymentMethod] = useState<"PAYSTACK" | "COD">("PAYSTACK");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);

  const [isHydrated, setIsHydrated] = useState(false);
  const [addressData, setAddressData] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadCartFromDatabase() {
      try {
        const response = await fetch("/api/cart", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load cart: ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled && Array.isArray(data.items)) {
          syncFromDB(data.items);
          setIsHydrated(true);
        }
      } catch (error) {
        console.error("Failed to synchronize checkout cart:", error);

        if (!cancelled) {
          setError(
            "We couldn't load your cart. Please refresh the page and try again."
          );
        }
      }
    }

    void loadCartFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [status, syncFromDB]);

  const selectedCartItems = isHydrated ? selectedItems() : [];
  const selectedTotal = isHydrated ? selectedTotalAmount() : 0;

  const selectedItemsKey = selectedCartItems
    .map((item) => `${item.id}:${item.quantity}:${item.price}`)
    .sort()
    .join("|");

  useEffect(() => {
    setAppliedDiscount(null);
  }, [selectedItemsKey]);

  const deliveryFee =
    quote?.isServiceable && quote?.minOrderMet
      ? quote.deliveryFee
      : 0;

  const discountAmount = appliedDiscount?.amount ?? 0;

  const finalTotal = Math.max(
    0,
    selectedTotal + deliveryFee - discountAmount
  );

  const handleAddressChange = (data: any, newQuote: any) => {
    setAddressData(data);
    setQuote(newQuote);
    setError("");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
      return;
    }

    if (
      selectedCartItems.length === 0 ||
      !addressData ||
      !quote?.isServiceable
    ) {
      return;
    }

    if (quote.minOrderValue && selectedTotal < quote.minOrderValue) {
      setError(
        `Minimum order value for this location is GH₵ ${quote.minOrderValue.toFixed(2)}`
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cartItemIds = selectedCartItems.map((item) => item.id);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItemIds,
          paymentMethod,
          discountCode: appliedDiscount?.code,
          localityId: addressData.localityId,
          address: {
            recipientName: addressData.recipientName,
            phone: addressData.phone,
            landmark: addressData.landmark,
            street: addressData.street,
            instructions: addressData.instructions,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
        } else {
          clearCart();
          setSuccess(true);
          setOrderId(data.orderId);
        }
      } else {
        console.error("Checkout API Error:", data);
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error("Network Error:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

         <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-2">
  {paymentMethod === "COD" ? "Order placed successfully" : "Order confirmed"}
</p>

<h1 className="text-3xl font-extrabold text-gray-900 mb-3">
  Thank you!
</h1>

<p className="text-sm text-gray-500 leading-relaxed">
  {paymentMethod === "COD"
    ? "Your order has been placed successfully. Please prepare to pay when your items are delivered."
    : "Your payment was successful and your order has been confirmed. We're looking forward to getting your items to you."}
</p>

          <div className="bg-gray-50 rounded-2xl p-4 mt-6 mb-6">
            <p className="text-xs text-gray-400 mb-1">ORDER REFERENCE</p>
            <p className="font-bold text-gray-900 font-mono break-all">
              {orderId}
            </p>
          </div>

          <Link
            href="/account/orders"
            className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-colors"
          >
            View My Orders
            <ChevronRight className="w-4 h-4" />
          </Link>

          <Link
            href="/"
            className="block mt-4 text-sm font-semibold text-gray-500 hover:text-orange-600"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (selectedCartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mb-5">
          <ShoppingBag className="w-9 h-9 text-orange-500" />
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
          Nothing to checkout
        </h2>

        <p className="text-sm text-gray-500 max-w-xs mb-7">
          You haven't selected any items for checkout. Head back to your cart
          and choose what you'd like to purchase.
        </p>

        <Link
          href="/cart"
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 px-8 rounded-xl transition-colors"
        >
          Return to Cart
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-28 lg:pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>

            <Link href="/" className="text-2xl font-black tracking-tight">
              <span className="text-orange-500">i</span>
              <span className="text-gray-900">BUY</span>
            </Link>

            <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />

            <h1 className="hidden sm:block text-sm font-bold text-gray-800">
              Secure Checkout
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
            <LockKeyhole className="w-4 h-4" />
            <span>Secure Checkout</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 lg:pt-10">
        {/* Page heading */}
        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link href="/cart" className="hover:text-orange-500">
              Shopping Cart
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-orange-600 font-semibold">Checkout</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Complete your order
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            You're just a few steps away from getting your items.
          </p>
        </div>

        {/* Checkout progress */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 mb-7">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-900">
                Cart
              </span>
            </div>

            <div className="flex-1 h-px bg-orange-200 mx-3" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <span className="text-xs sm:text-sm font-bold text-orange-600">
                Delivery
              </span>
            </div>

            <div className="flex-1 h-px bg-gray-200 mx-3" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-400">
                Payment
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Delivery address */}
            <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm shadow-gray-200/40">
              <div className="px-5 sm:px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-500" />
                </div>

                <div>
                  <h2 className="font-bold text-gray-900">
                    Delivery information
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Where should we deliver your order?
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <DeliveryAddressForm
                  cartSubtotal={selectedTotal}
                  onAddressChange={handleAddressChange}
                />
              </div>
            </section>

            {/* Order items */}
            <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm shadow-gray-200/40">
              <div className="px-5 sm:px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-orange-500" />
                  </div>

                  <div>
                    <h2 className="font-bold text-gray-900">Your order</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedCartItems.length}{" "}
                      {selectedCartItems.length === 1 ? "item" : "items"}{" "}
                      selected
                    </p>
                  </div>
                </div>

                <Link
                  href="/cart"
                  className="text-xs font-bold text-orange-600 hover:text-orange-700"
                >
                  Edit cart
                </Link>
              </div>

              <div className="divide-y divide-gray-100">
                {selectedCartItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex gap-4 items-center"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBag className="w-7 h-7" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-2">
                        {item.title}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                        <Store className="w-3.5 h-3.5" />
                        <span className="truncate">
                          {item.sellerName || "iBUY Marketplace"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs bg-gray-100 rounded-md px-2 py-1 font-semibold text-gray-600">
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm sm:text-base font-extrabold text-gray-900">
                        GH₵ {(item.price * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        GH₵ {item.price.toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50/70 px-5 py-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">
                  Items subtotal
                </span>
                <span className="text-sm font-extrabold text-gray-900">
                  GH₵ {selectedTotal.toFixed(2)}
                </span>
              </div>
            </section>

            {/* Delivery assurance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    Reliable delivery
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    To your location
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    Secure payment
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Protected checkout
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24">
            <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm shadow-gray-200/40">
              <div className="bg-gray-900 px-5 sm:px-6 py-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Payment summary
                  </span>
                </div>

                <p className="text-3xl font-extrabold tracking-tight mt-2">
                  GH₵ {finalTotal.toFixed(2)}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Your total payable amount
                </p>
              </div>

              <div className="p-5 sm:p-6">
                {/* Promo code */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-bold text-gray-900">
                      Have a promo code?
                    </h3>
                  </div>

                  <PromoCodeInput
                    cartItemIds={selectedCartItems.map((item) => item.id)}
                    currentDiscount={appliedDiscount}
                    onDiscountApplied={(amount, code) => {
                      setAppliedDiscount({ amount, code });
                      setError("");
                    }}
                    onDiscountRemoved={() => {
                      setAppliedDiscount(null);
                      setError("");
                    }}
                  />
                </div>

                {/* Breakdown */}
                <div className="space-y-4 border-t border-gray-100 pt-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Subtotal ({selectedCartItems.length} items)
                    </span>
                    <span className="font-semibold text-gray-900">
                      GH₵ {selectedTotal.toFixed(2)}
                    </span>
                  </div>

                  {appliedDiscount && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-green-600">
                        Discount ({appliedDiscount.code})
                      </span>
                      <span className="font-bold text-green-600">
                        - GH₵ {discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery fee</span>
                    <span className="font-semibold text-gray-900">
                      {quote?.isServiceable ? (
                        `GH₵ ${deliveryFee.toFixed(2)}`
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">
                          Awaiting location
                        </span>
                      )}
                    </span>
                  </div>

                  {quote?.isServiceable && !quote?.minOrderMet && (
                    <div className="bg-orange-50 rounded-lg p-3 text-xs text-orange-700">
                      Your order hasn't met the minimum order value for this
                      delivery location.
                    </div>
                  )}

                  <div className="border-t border-dashed border-gray-200 pt-5 flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-gray-900">
                        Total to pay
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Inclusive of applicable delivery fees
                      </p>
                    </div>

                    <p className="text-2xl font-black text-orange-600">
                      GH₵ {finalTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
                  {/* Payment method */}
<div className="mt-6 border-t border-gray-100 pt-5">
  <h3 className="text-sm font-bold text-gray-900 mb-3">
    Choose payment method
  </h3>

  <div className="space-y-3">
    {quote?.onlinePayEnabled !== false && (
      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${
        paymentMethod === "PAYSTACK"
          ? "border-orange-500 bg-orange-50"
          : "border-gray-200"
      }`}>
        <input
          type="radio"
          name="paymentMethod"
          value="PAYSTACK"
          checked={paymentMethod === "PAYSTACK"}
          onChange={() => setPaymentMethod("PAYSTACK")}
          className="accent-orange-500"
        />
        <CreditCard className="w-5 h-5 text-orange-500" />
        <div>
          <p className="text-sm font-bold text-gray-900">
            Pay Online
          </p>
          <p className="text-xs text-gray-500">
            Pay securely through Paystack
          </p>
        </div>
      </label>
    )}

    {quote?.codEnabled && (
      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${
        paymentMethod === "COD"
          ? "border-orange-500 bg-orange-50"
          : "border-gray-200"
      }`}>
        <input
          type="radio"
          name="paymentMethod"
          value="COD"
          checked={paymentMethod === "COD"}
          onChange={() => setPaymentMethod("COD")}
          className="accent-orange-500"
        />
        <Truck className="w-5 h-5 text-green-600" />
        <div>
          <p className="text-sm font-bold text-gray-900">
            Cash on Delivery
          </p>
          <p className="text-xs text-gray-500">
            Pay when your order arrives
          </p>
        </div>
      </label>
    )}
  </div>
</div>
                {error && (
                  <div className="mt-5 p-3.5 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form id="checkout-form" onSubmit={handlePlaceOrder}>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      selectedCartItems.length === 0 ||
                      !quote?.isServiceable ||
                      !quote?.minOrderMet
                    }
                    className="w-full mt-6 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <LockKeyhole className="w-4 h-4" />
                    )}

                    {loading
  ? "Processing order..."
  : paymentMethod === "COD"
    ? "Place Order"
    : "Place Order & Pay"}
                  </button>
                </form>

                <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-gray-400">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  Your checkout is protected and secure
                </div>
              </div>
            </section>

            <div className="mt-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <PackageCheck className="w-4 h-4" />
              Thank you for shopping with iBUY
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile checkout bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              Total payable
            </p>
            <p className="text-xl font-black text-gray-900">
              GH₵ {finalTotal.toFixed(2)}
            </p>
          </div>

          <button
            type="submit"
            form="checkout-form"
            disabled={
              loading ||
              selectedCartItems.length === 0 ||
              !quote?.isServiceable ||
              !quote?.minOrderMet
            }
            className="flex-1 max-w-[210px] bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              paymentMethod === "COD" ? "Place Order" : "Place Order & Pay"
            )}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}