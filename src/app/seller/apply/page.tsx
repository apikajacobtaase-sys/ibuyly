// src/app/seller/apply/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, ArrowLeft } from "lucide-react";

export default function SellerApplyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/seller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Application submitted successfully! We will review it shortly.");
        setTimeout(() => router.push("/account"), 3000);
      } else {
        setError(data.error || "Failed to submit application");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ibuy-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Link href="/account" className="inline-flex items-center gap-2 text-sm text-ibuy-text-secondary hover:text-ibuy-orange mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Account
        </Link>

        <div className="bg-white rounded-xl border border-ibuy-border p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-ibuy-text">Start Selling on iBUY</h1>
            <p className="text-ibuy-text-secondary mt-2">
              Apply to open your store and reach thousands of customers across Ghana.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Business / Store Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Kwame Electronics"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Business Category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Electronics, Fashion, Home & Garden"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ibuy-text mb-1.5">
                Tell us about your business <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2.5 border border-ibuy-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="What do you sell? Why should customers choose your store?"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50"
            >
              {isLoading ? "Submitting..." : "Submit Application"}
            </button>
          </form>

          <p className="text-center text-xs text-ibuy-text-secondary mt-6">
            By submitting, you agree to iBUY&apos;s Seller Terms and Conditions.
          </p>
        </div>
      </div>
    </div>
  );
}