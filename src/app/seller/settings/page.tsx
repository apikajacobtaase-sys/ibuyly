// src/app/seller/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Store, Shield, User, Clock } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

interface SellerData {
  id: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  verificationStatus: string;
  commissionRate: number;
  userEmail: string;
  userPhone?: string | null;
  userName: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    description: "",
    logoUrl: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/seller/settings");
      const data = await res.json();
      if (res.ok) {
        setSeller(data.seller);
        setFormData({
          businessName: data.seller.businessName,
          businessType: data.seller.businessType || "",
          description: data.seller.description || "",
          logoUrl: data.seller.logoUrl || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/seller/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert("✅ Settings saved successfully!");
        fetchSettings();
      } else {
        alert("❌ Failed to save settings");
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!seller) {
    return <div className="text-center py-12 text-gray-500">Failed to load settings</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Store Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your store profile and business information</p>
      </div>

      {/* Verification Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Verification Status</h3>
              <p className="text-sm text-gray-500 mt-1">
                Your store&apos;s verification determines customer trust and platform visibility.
              </p>
            </div>
          </div>
          <StatusBadge status={seller.verificationStatus} size="md" />
        </div>
      </div>

      {/* Store Information Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Store className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Store Information</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name *</label>
          <input
            type="text"
            required
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Type</label>
          <input
            type="text"
            value={formData.businessType}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            placeholder="e.g., Electronics, Fashion, Food & Beverage"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Description</label>
          <textarea
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Tell customers about your store..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo URL</label>
          <input
            type="url"
            value={formData.logoUrl}
            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {formData.logoUrl && (
            <div className="mt-3 w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <img src={formData.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Account Info (Read-only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Account Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Owner Name</p>
            <p className="font-medium text-gray-900">{seller.userName || "Not set"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="font-medium text-gray-900">{seller.userEmail}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Phone</p>
            <p className="font-medium text-gray-900">{seller.userPhone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Member Since</p>
            <p className="font-medium text-gray-900">{new Date(seller.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Commission Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Marketplace Commission</p>
          <p>
            iBUY charges a <strong>{seller.commissionRate}%</strong> commission on all completed sales.
            This fee is automatically deducted from your earnings before payouts.
          </p>
        </div>
      </div>
    </div>
  );
}