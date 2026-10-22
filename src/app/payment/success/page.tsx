 // src/app/payment/success/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found in the URL.");
      return;
    }

    const verifyPayment = async () => {
      // ✅ FIX: Add a timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds

      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setOrderId(data.orderId || "");
          setMessage(data.message || "Your payment was successful!");
        } else {
          setStatus("failed");
          // ✅ Show specific error from API
          setMessage(data.error || "Payment verification failed.");
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Verification network error:", error);
        setStatus("failed");
        
        // ✅ Helpful message for timeouts or network issues
        if (error instanceof DOMException && error.name === "AbortError") {
           setMessage("Verification is taking longer than expected. Please check your order status manually.");
        } else {
           setMessage("Network error. Please check your orders page or contact support.");
        }
      }
    };

    verifyPayment();
  }, [reference]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
        
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 text-green-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying Payment...</h1>
            <p className="text-gray-500">Please wait while we securely confirm your transaction.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-2">{message}</p>
            {orderId && (
              <p className="text-sm text-gray-500 mb-6">
                Order ID: <span className="font-mono font-semibold">{orderId}</span>
              </p>
            )}
            <Link 
              href="/account/orders" 
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors mt-4"
            >
              View My Orders
            </Link>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Issue</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            
            {/* ✅ Helpful tip for insufficient funds */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-left">
              <p className="text-xs text-yellow-800 font-medium mb-1">💡 Tip:</p>
              <p className="text-xs text-yellow-700">
                If your payment was declined, it may be due to insufficient funds or a daily limit. 
                Please try a different card or mobile money number.
              </p>
            </div>

            {reference && (
              <p className="text-xs text-gray-400 mb-6">
                Reference: <span className="font-mono">{reference}</span>
              </p>
            )}
            
            <div className="flex flex-col gap-3">
              <Link 
                href="/account/orders" 
                className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Check Order Status
              </Link>
              <Link 
                href="/cart" 
                className="block w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
              >
                Return to Cart
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}