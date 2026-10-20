// src/app/payment/success/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
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
      try {
        // 👇 FIX: Call your POST /api/payments/verify endpoint with a JSON body
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setOrderId(data.orderId || "");
          setMessage(data.message || "Your payment was successful and your order has been confirmed!");
        } else {
          setStatus("failed");
          setMessage(data.error || data.message || "Payment verification failed. Please contact support with your reference ID.");
        }
      } catch (error) {
        console.error("Verification network error:", error);
        setStatus("failed");
        setMessage("Network error while verifying payment. Please check your orders page or contact support.");
      }
    };

    verifyPayment();
  }, [reference]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 text-green-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying Payment...</h1>
            <p className="text-gray-500">Please wait while we securely confirm your transaction with Paystack.</p>
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
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Issue</h1>
            <p className="text-gray-600 mb-2">{message}</p>
            {reference && (
              <p className="text-xs text-gray-400 mb-6">
                Reference: <span className="font-mono">{reference}</span>
              </p>
            )}
            <Link 
              href="/account/orders" 
              className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
            >
              Check Order Status
            </Link>
          </>
        )}

      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}