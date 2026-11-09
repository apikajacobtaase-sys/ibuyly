"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Save,
  Lock,
  MapPin,
  Bell,
  Trash2,
  User,
  Camera,
  Loader2,
} from "lucide-react";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
};

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile Info", icon: User },
    { id: "security", label: "Password & Security", icon: Lock },
    { id: "addresses", label: "Saved Addresses", icon: MapPin },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Account Settings
      </h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors mt-8"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5 md:p-6 min-h-[400px]">
          {activeTab === "profile" && (
            <ProfileSettings updateSession={update} sessionName={session?.user?.name ?? ""} />
          )}
          {activeTab === "security" && <SecuritySettings />}
          {activeTab === "addresses" && <AddressSettings />}
          {activeTab === "notifications" && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({
  updateSession,
  sessionName,
}: {
  updateSession: () => Promise<unknown>;
  sessionName: string;
}) {
  const [profile, setProfile] = useState<Profile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatarUrl: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/user/profile");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load profile.");
        }

        if (!cancelled) {
          setProfile({
            firstName: data.user.firstName || "",
            lastName: data.user.lastName || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            avatarUrl: data.user.avatarUrl || null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName =
    `${profile.firstName} ${profile.lastName}`.trim() || sessionName || "User";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  async function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPEG, PNG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your image must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/user/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Photo upload failed.");
      }

      setProfile((current) => ({
        ...current,
        avatarUrl: data.user.avatarUrl,
      }));

      setPreview(null);
      await updateSession();
      setMessage("Profile photo updated successfully.");
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile.");
      }

      setProfile((current) => ({
        ...current,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        phone: data.user.phone || "",
      }));

      await updateSession();
      setMessage("Your profile has been updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading your profile...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Personal Information
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your personal details and profile photo.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          {preview || profile.avatarUrl ? (
            <img
              src={preview || profile.avatarUrl || ""}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl font-bold border border-green-200">
              {initials || "U"}
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div>
          <p className="font-semibold text-gray-900">{displayName}</p>
          <p className="text-xs text-gray-500 mb-2">Your personal profile photo</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePhotoChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {uploading ? "Uploading..." : "Change photo"}
          </button>
          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF  Max 5 MB</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <input
            value={profile.firstName}
            onChange={(e) =>
              setProfile({ ...profile, firstName: e.target.value })
            }
            maxLength={80}
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            value={profile.lastName}
            onChange={(e) =>
              setProfile({ ...profile, lastName: e.target.value })
            }
            maxLength={80}
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            value={profile.email}
            disabled
            className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Your account email cannot be changed here.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number / WhatsApp
          </label>
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) =>
              setProfile({ ...profile, phone: e.target.value })
            }
            maxLength={30}
            placeholder="+233 24 000 0000"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
          {error}
        </p>
      )}

      {message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || uploading}
        className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Change Password
      </h2>
      <div className="space-y-3">
        <input type="password" placeholder="Current Password" className="w-full p-2 border rounded-lg" />
        <input type="password" placeholder="New Password" className="w-full p-2 border rounded-lg" />
        <input type="password" placeholder="Confirm New Password" className="w-full p-2 border rounded-lg" />
      </div>
      <button type="button" className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
        Update Password
      </button>
    </div>
  );
}

function AddressSettings() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Saved Addresses</h2>
        <button type="button" className="text-sm text-green-600 font-medium">
          + Add New
        </button>
      </div>
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="font-medium">Home</p>
        <p className="text-sm text-gray-600">Fiapre, Sunyani, Bono Region</p>
        <p className="text-sm text-gray-600">024XXXXXXX</p>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Preferences
      </h2>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Order Updates</p>
          <p className="text-sm text-gray-500">
            Get notified when your order status changes.
          </p>
        </div>
        <input type="checkbox" defaultChecked className="w-5 h-5 text-green-600" />
      </div>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Promotions</p>
          <p className="text-sm text-gray-500">
            Receive offers and discount codes.
          </p>
        </div>
        <input type="checkbox" className="w-5 h-5 text-green-600" />
      </div>
    </div>
  );
}
