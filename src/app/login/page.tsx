
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { Loader2, ShoppingBag } from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const requestedCallback = searchParams.get("callbackUrl");
    let callbackUrl = "/account";

    // Only allow internal redirects.
    if (requestedCallback?.startsWith("/") &&
        !requestedCallback.startsWith("//")) {
      callbackUrl = requestedCallback;
    }

    router.replace(callbackUrl);
  }, [status, router, searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Invalid email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      // Merge guest cart after successful authentication.
      try {
        const storageKey = "ibuy-cart-storage";
        const storedCart = localStorage.getItem(storageKey);

        if (storedCart) {
          const parsed = JSON.parse(storedCart);
          const guestItems = parsed?.state?.items ?? [];

          if (Array.isArray(guestItems) && guestItems.length > 0) {
            const response = await fetch("/api/cart/merge", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                guestCart: guestItems.map((item: {
                  productId: string;
                  variantId?: string;
                  offerId?: string | null;
                  quantity: number;
                }) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  offerId: item.offerId,
                  quantity: item.quantity,
                })),
              }),
            });

            if (response.ok) {
              useCartStore.getState().clearGuestCart();
            } else {
              console.error(
                "Guest cart merge failed:",
                response.status,
                await response.text()
              );
            }
          }
        }
      } catch (mergeError) {
        // Do not prevent login from succeeding if cart merging fails.
        console.error("Guest cart merge failed:", mergeError);
      }

      const requestedCallback = searchParams.get("callbackUrl");
      let callbackUrl = "/account";

      if (
        requestedCallback?.startsWith("/") &&
        !requestedCallback.startsWith("//")
      ) {
        callbackUrl = requestedCallback;
      }

      router.replace(callbackUrl);
    } catch (submitError) {
      console.error("Login failed:", submitError);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Welcome Back
          </h1>

          <p className="text-gray-500 text-sm">
            Sign in to your iBUY account
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg mb-4 text-sm bg-red-50 text-red-600 border border-red-100"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors bg-gray-50 focus:bg-white text-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>

            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
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
            <Link
              href="/register"
              className="text-green-600 hover:text-green-700 font-semibold"
            >
              Create one
            </Link>
          </p>

          <Link
            href="/forgot-password"
            className="text-xs text-gray-400 hover:text-gray-600 block"
          >
            Forgot Password?
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
