 // src/app/login/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { Loader2, ShoppingBag } from "lucide-react";

// 1. The Inner Component that uses useSearchParams
function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we only run client-side logic after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && status === "authenticated") {
      const callbackUrl = searchParams.get("callbackUrl") || "/account";
      router.replace(callbackUrl);
    }
  }, [status, router, searchParams, isMounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        setIsLoading(false);
      } else {
        // ✅ SUCCESS: Merge guest cart with account cart
        try {
          const guestCartData = localStorage.getItem("cart-storage");
          if (guestCartData) {
            const parsed = JSON.parse(guestCartData);
            const guestCart = parsed?.state?.items || [];
            
            if (guestCart.length > 0) {
              const mergeRes = await fetch("/api/cart/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  guestCart: guestCart.map((item: any) => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                  })),
                }),
              });

              if (mergeRes.ok) {
                const store = useCartStore.getState();
                if (typeof store.clearGuestCart === "function") {
                  store.clearGuestCart();
                } else {
                  localStorage.removeItem("cart-storage");
                }
              }
            }
          }
        } catch (err) {
          console.error("Cart merge failed:", err);
        }

        const callbackUrl = searchParams.get("callbackUrl") || "/account";
        router.replace(callbackUrl);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  if (!isMounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  if (status === "authenticated") {
    return null; // Redirecting...
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        
        {/* Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Sign in to your iBUY account</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg mb-4 text-sm bg-red-50 text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors bg-gray-50 focus:bg-white text-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors bg-gray-50 focus:bg-white text-gray-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-green-600 hover:text-green-700 font-semibold">
              Create one
            </Link>
          </p>
          <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600 block">
            Forgot Password?
          </Link>
        </div>
      </div>
    </div>
  );
}

// 2. The Wrapper Component with Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}