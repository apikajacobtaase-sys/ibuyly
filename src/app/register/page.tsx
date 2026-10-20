// src/app/register/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Account created! Redirecting to login...");
                  // ✅ Merge guest cart with new account cart
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
                  // Clear the guest cart from localStorage after successful merge
                  const { useCartStore } = await import("@/store/cartStore");
                  useCartStore.getState().clearGuestCart();
                }
              }
            }
          } catch (error) {
            console.error("Cart merge failed:", error);
          }
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ibuy-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-ibuy-orange">
            iBUY
          </Link>
          <p className="text-ibuy-text-secondary mt-2">Create your account</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-ibuy-border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">
                {success}
              </div>
            )}

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                  placeholder="Kwame"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                  placeholder="Asante"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                placeholder="you@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                placeholder="024 123 4567"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ibuy-orange"
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                required
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="mt-1 w-4 h-4 text-ibuy-orange border-gray-300 rounded focus:ring-ibuy-orange"
              />
              <label className="text-sm text-ibuy-text-secondary">
                I agree to the{" "}
                <Link href="/terms" className="text-ibuy-orange hover:underline font-medium">
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-ibuy-orange hover:underline font-medium">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-ibuy-orange text-white py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition disabled:opacity-50"
            >
              <UserPlus className="w-5 h-5" />
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-sm text-ibuy-text-secondary mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-ibuy-orange hover:underline font-medium">
              Log In
            </Link>
          </p>
        </div>

        {/* Security Note */}
        <p className="text-center text-xs text-ibuy-text-secondary mt-4">
          🔒 Your account will be created as a Customer. Seller access requires a separate application.
        </p>
      </div>
    </div>
  );
}