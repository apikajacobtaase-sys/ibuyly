"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Store,
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
  ImagePlus,
  Upload,
  X,
} from "lucide-react";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

interface FormData {
  businessName: string;
  description: string;
  businessType: string;
}

export default function SellerSetupPage() {
  const { status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoSuccess, setLogoSuccess] = useState("");

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    description: "",
    businessType: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/seller/setup");
      return;
    }

    async function fetchProfile() {
      try {
        const res = await fetch("/api/seller/profile");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load store profile.");
        }

        const profile = data.profile;

        setFormData({
          businessName: profile.businessName || "",
          description: profile.description || "",
          businessType: profile.businessType || "",
        });

        setLogoUrl(profile.logoUrl || "");
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Failed to load store profile.",
        });
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
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

      setLogoUrl(data.logoUrl);
      setLogoSuccess("Store logo uploaded successfully.");
    } catch (error) {
      setLogoError(
        error instanceof Error
          ? error.message
          : "Network error. Please try again."
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

      setLogoUrl("");
      setLogoSuccess("Store logo removed.");
    } catch (error) {
      setLogoError(
        error instanceof Error
          ? error.message
          : "Network error. Please try again."
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.details
          ? Object.values(data.details).flat().join(", ")
          : data.error || "Failed to save store profile.";

        throw new Error(errorMessage);
      }

      setMessage({
        type: "success",
        text: data.message || "Store setup saved successfully!",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Network error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Store className="w-6 h-6 text-indigo-600" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Store Setup
            </h1>
            <p className="text-sm text-gray-500">
              Manage your business identity and store appearance.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`mb-5 p-3 rounded-lg flex items-start gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-6"
      >
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Store Identity
            </h2>
            <p className="text-sm text-gray-500">
              Give customers a clear impression of your business.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
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

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {isUploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploadingLogo ? "Uploading..." : "Upload Store Logo"}
              </button>

              <p className="text-xs text-gray-500">
                JPEG, PNG, WebP or GIF. Maximum size: 5 MB.
              </p>

              {logoUrl && !isUploadingLogo && (
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
            <p className="text-sm text-red-600" role="alert">
              {logoError}
            </p>
          )}

          {logoSuccess && (
            <p className="text-sm text-green-600" role="status">
              {logoSuccess}
            </p>
          )}
        </section>

        <section className="space-y-4 pt-5 border-t border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Business Information
          </h2>

          <div>
            <label
              htmlFor="businessName"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Business Name
            </label>
            <input
              id="businessName"
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={100}
              placeholder="Enter your store name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="businessType"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Business Type
            </label>
            <input
              id="businessType"
              type="text"
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
              maxLength={50}
              placeholder="e.g., Retail, Wholesale, Electronics"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Store Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={5}
              maxLength={1000}
              placeholder="Tell customers what makes your store special..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {formData.description.length}/1000
            </p>
          </div>
        </section>

        <div className="pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || isUploadingLogo}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Store Setup
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
