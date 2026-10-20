// src/app/seller/settings/staff/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Check, X } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

interface StaffMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
}

export default function SellerStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [permissions, setPermissions] = useState({
    canManageProducts: false,
    canManageInventory: false,
    canManageOrders: false,
    canViewFinances: false,
    canManageReviews: false,
    canManageSettings: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/seller/staff");
      const data = await res.json();
      if (res.ok) setStaff(data.staff || []);
    } catch (error) {
      console.error("Failed to fetch staff", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/seller/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, permissions }),
      });
      const data = await res.json();

      if (res.ok) {
        setShowAddModal(false);
        setNewEmail("");
        setPermissions({
          canManageProducts: false, canManageInventory: false, canManageOrders: false,
          canViewFinances: false, canManageReviews: false, canManageSettings: false,
        });
        fetchStaff();
      } else {
        setError(data.error || "Failed to add staff");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-sm text-gray-500 mt-1">Invite team members and manage their permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {staff.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No staff members yet. Add your first team member!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map((member) => (
              <div key={member.id} className="p-5 hover:bg-gray-50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{member.name}</p>
                      <StatusBadge status={member.role} size="sm" />
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(member.permissions).map(([key, value]) => {
                        if (!value) return null;
                        const label = key.replace("canManage", "Manage ").replace("canView", "View ").replace(/([A-Z])/g, " $1").trim();
                        return (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full font-medium">
                            <Check className="w-3 h-3" /> {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Added {new Date(member.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Staff Member</h3>
            
            <form onSubmit={handleAddStaff} className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">{error}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">User Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">The user must already have an iBUY account.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {[
                    { key: "canManageProducts", label: "Manage Products" },
                    { key: "canManageInventory", label: "Manage Inventory" },
                    { key: "canManageOrders", label: "Manage Orders" },
                    { key: "canViewFinances", label: "View Finances" },
                    { key: "canManageReviews", label: "Manage Reviews" },
                    { key: "canManageSettings", label: "Manage Settings" },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[perm.key as keyof typeof permissions]}
                        onChange={() => togglePermission(perm.key)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(""); }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> {isSubmitting ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}