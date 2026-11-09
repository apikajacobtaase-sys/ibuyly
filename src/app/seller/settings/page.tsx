// src/app/seller/settings/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Store, Shield, User, Clock, ImagePlus, Upload, X } from "lucide-react";
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

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export default function SettingsPage() {
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoSuccess, setLogoSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setLogoError("");
    setLogoSuccess("");

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Choose a JPEG, PNG, WebP or GIF image.");
      event.target.value = "";
      return;
    }

    if (file.size === 0 || file.size > MAX_LOGO_SIZE) {
      setLogoError("Your image must be between 1 byte and 5 MB.");
      event.target.value = "";
      return;
    }

    setIsUploadingLogo(true);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);

      const res = await fetch("/api/seller/settings/logo", {
        method: "POST",
        body: uploadData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload store logo.");
      }

      setFormData((previous) => ({
        ...previous,
        logoUrl: data.logoUrl,
      }));

      setSeller((previous) =>
        previous ? { ...previous, logoUrl: data.logoUrl } : previous
      );

      setLogoSuccess("Store logo uploaded successfully.");
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Network error. Please try again."
      );
    } finally {
      setIsUploadingLogo(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError("");
    setLogoSuccess("");

    try {
      const res = await fetch("/api/seller/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: "" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove store logo.");
      }

      setFormData((previous) => ({ ...previous, logoUrl: "" }));
      setSeller((previous) =>
        previous ? { ...previous, logoUrl: null } : previous
      );

      setLogoSuccess("Store logo removed.");
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Network error. Please try again."
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/seller/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName,
          businessType: formData.businessType,
          description: formData.description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSeller(data.seller);
      alert("Settings saved successfully!");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Network error. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Store Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your store profile and business information.
        </p>
      </div>

      {/* Verification Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Verification Status
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Your store&apos;s verification determines customer trust and
                platform visibility.
              </p>
            </div>
          </div>
          <StatusBadge status={seller.verificationStatus} size="md" />
        </div>
      </div>

      {/* Store Information */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center gap-3 mb-2">
          <Store className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Store Information</h3>
        </div>

        {/* Store Logo */}
        <div className="border-b border-gray-100 pb-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Store Logo
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Store logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImagePlus className="w-9 h-9 text-gray-300" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                className="hidden"
                id="store-logo-upload"
              />

              <label
                htmlFor="store-logo-upload"
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 cursor-pointer transition ${
                  isUploadingLogo
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`}
              >
                <Upload className="w-4 h-4" />
                {isUploadingLogo ? "Uploading..." : "Upload Store Logo"}
              </label>

              <p className="text-xs text-gray-500">
                JPEG, PNG, WebP or GIF. Maximum size: 5 MB.
              </p>

              {formData.logoUrl && !isUploadingLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                  Remove logo
                </button>
              )}
            </div>
          </div>

          {logoError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {logoError}
            </p>
          )}

          {logoSuccess && (
            <p className="mt-3 text-sm text-green-600" role="status">
              {logoSuccess}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Name *
          </label>
          <input
            type="text"
            required
            value={formData.businessName}
            onChange={(event) =>
              setFormData({
                ...formData,
                businessName: event.target.value,
              })
            }
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Type
          </label>
          <input
            type="text"
            value={formData.businessType}
            onChange={(event) =>
              setFormData({
                ...formData,
                businessType: event.target.value,
              })
            }
            placeholder="e.g., Electronics, Fashion, Food & Beverage"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Store Description
          </label>
          <textarea
            rows={4}
            value={formData.description}
            onChange={(event) =>
              setFormData({
                ...formData,
                description: event.target.value,
              })
            }
            placeholder="Tell customers about your store..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSaving || isUploadingLogo}
            className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Account Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-gray-900">
            Account Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Owner Name</p>
            <p className="font-medium text-gray-900">
              {seller.userName || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="font-medium text-gray-900">{seller.userEmail}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Phone</p>
            <p className="font-medium text-gray-900">
              {seller.userPhone || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Member Since</p>
            <p className="font-medium text-gray-900">
              {new Date(seller.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Commission Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Marketplace Commission</p>
          <p>
            iBUY charges a <strong>{seller.commissionRate}%</strong> commission
            on all completed sales. This fee is automatically deducted from
            your earnings before payouts.
          </p>
        </div>
      </div>
    </div>
  );
}
