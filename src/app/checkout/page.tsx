 // src/app/checkout/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import DeliveryAddressForm from "@/components/checkout/DeliveryAddressForm";
import { useSession } from "next-auth/react";

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  // ✅ Get hydration state from store if available, or manage locally
  const { selectedItems, selectedTotalAmount, clearCart, hasHydrated } = useCartStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  
  // Address & Quote State
  const [addressData, setAddressData] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);

  const selectedCartItems = selectedItems();
  const selectedTotal = selectedTotalAmount();
  
  const deliveryFee = (quote?.isServiceable && quote?.minOrderMet) ? quote.deliveryFee : 0;
  const finalTotal = selectedTotal + deliveryFee;

  // ✅ Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  const handleAddressChange = (data: any, newQuote: any) => {
    setAddressData(data);
    setQuote(newQuote);
    setError("");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (status !== "authenticated") return;

    // ✅ Wait for hydration if needed
    if (!hasHydrated) {
      setError("Loading your cart... Please try again in a moment.");
      return;
    }

    if (selectedCartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!addressData || !quote?.isServiceable) {
      setError("Please select a valid delivery address.");
      return;
    }
    
    if (quote.minOrderValue && selectedTotal < quote.minOrderValue) {
      setError(`Minimum order value for this location is GH₵ ${quote.minOrderValue.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // ✅ Ensure we are sending the correct IDs
      const cartItemIds = selectedCartItems.map((i) => i.id);
      
      console.log("🚀 Initiating Checkout with Items:", cartItemIds);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItemIds: cartItemIds,
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
        // ✅ Clear cart ONLY after successful API response
        clearCart(); 

        if (data.authorizationUrl) {
          console.log("✅ Redirecting to Paystack:", data.authorizationUrl);
          window.location.href = data.authorizationUrl;
          return; 
        }

        setSuccess(true);
        setOrderId(data.orderId);
      } else {
        console.error("❌ Checkout API Error:", data);
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error("❌ Network Error:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Show loading while hydrating or checking session
  if (status === "loading" || !hasHydrated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-2">Your order ID is: <span className="font-mono font-semibold text-gray-900">{orderId}</span></p>
          <Link href="/account/orders" className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors mt-6">
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  if (selectedCartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No items selected</h2>
        <p className="text-gray-500 mb-6">Go back to your cart to select items for checkout.</p>
        <Link href="/cart" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors">
          Return to Cart
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <DeliveryAddressForm 
              cartSubtotal={selectedTotal} 
              onAddressChange={handleAddressChange} 
            />
          </div>
          
          {/* Order Summary List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
             <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Order Summary</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {selectedCartItems.map((item) => (
                  <div key={item.id} className="p-4 flex gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 relative">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">Sold by: {item.sellerName}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">GH₵ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-24 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">GH₵ {selectedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium text-gray-900">
                  {quote?.isServiceable ? `GH₵ ${deliveryFee.toFixed(2)}` : "Calculated after location"}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-green-600">GH₵ {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handlePlaceOrder} className="mt-6">
              <button
                type="submit"
                disabled={loading || selectedCartItems.length === 0 || !quote?.isServiceable || !quote?.minOrderMet}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? "Processing..." : "Place Order"}
              </button>
            </form>
            
            <p className="text-xs text-gray-400 text-center mt-4">
              Secure checkout powered by Paystack
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}