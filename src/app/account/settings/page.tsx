 // src/app/account/settings/page.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Save, Lock, MapPin, Bell, Trash2, User } from "lucide-react";

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
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
          
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors mt-8">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6 min-h-[400px]">
          {activeTab === "profile" && <ProfileSettings session={session} update={update} />}
          {activeTab === "security" && <SecuritySettings />}
          {activeTab === "addresses" && <AddressSettings />}
          {activeTab === "notifications" && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components for each tab ---

function ProfileSettings({ session, update }: any) {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Add API call to update user profile here
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input defaultValue={session?.user?.name?.split(' ')[0]} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input defaultValue={session?.user?.name?.split(' ')[1]} className="w-full p-2 border rounded-lg" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input defaultValue={session?.user?.email} disabled className="w-full p-2 border rounded-lg bg-gray-50" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (+233)</label>
          <input placeholder="24XXXXXXX" className="w-full p-2 border rounded-lg" />
        </div>
      </div>
      <button disabled={loading} className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
        <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
      <div className="space-y-3">
        <input type="password" placeholder="Current Password" className="w-full p-2 border rounded-lg" />
        <input type="password" placeholder="New Password" className="w-full p-2 border rounded-lg" />
        <input type="password" placeholder="Confirm New Password" className="w-full p-2 border rounded-lg" />
      </div>
      <button className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">Update Password</button>
    </div>
  );
}

function AddressSettings() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Saved Addresses</h2>
        <button className="text-sm text-green-600 font-medium">+ Add New</button>
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Order Updates</p>
          <p className="text-sm text-gray-500">Get notified when your order status changes.</p>
        </div>
        <input type="checkbox" defaultChecked className="w-5 h-5 text-green-600" />
      </div>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Promotions</p>
          <p className="text-sm text-gray-500">Receive offers and discount codes.</p>
        </div>
        <input type="checkbox" className="w-5 h-5 text-green-600" />
      </div>
    </div>
  );
}