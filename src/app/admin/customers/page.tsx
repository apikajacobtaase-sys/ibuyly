// src/app/admin/customers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Shield, Ban, CheckCircle, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  accountStatus: string;
  orderCount: number;
  reviewCount: number;
  createdAt: string;
}

export default function AdminCustomersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const action = newStatus === "ACTIVE" ? "activate" : newStatus.toLowerCase();
    const reason = newStatus !== "ACTIVE" 
      ? prompt(`Reason for ${action}ing this user:`) 
      : null;
      
    if (newStatus !== "ACTIVE" && reason === null) return; // User cancelled prompt

    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountStatus: newStatus, reason }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    }
  };

  if (session?.user?.role !== "SUPER_ADMIN") {
    return (
      <div className="text-center py-16">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">Only Super Admins can manage user account statuses.</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || u.accountStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage customer accounts, roles, and suspension status
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">All Users ({filteredUsers.length})</h3>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No users found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <div key={user.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <StatusBadge status={user.role} size="sm" />
                    <StatusBadge 
                      status={user.accountStatus} 
                      size="sm" 
                      customStyles={{
                        ACTIVE: "bg-green-100 text-green-800 border-green-200",
                        SUSPENDED: "bg-yellow-100 text-yellow-800 border-yellow-200",
                        DISABLED: "bg-red-100 text-red-800 border-red-200",
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 break-all">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {user.orderCount} orders • {user.reviewCount} reviews • Joined {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user.accountStatus !== "ACTIVE" && (
                    <button
                      onClick={() => handleStatusChange(user.id, "ACTIVE")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Activate
                    </button>
                  )}
                  {user.accountStatus === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => handleStatusChange(user.id, "SUSPENDED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Suspend
                      </button>
                      <button
                        onClick={() => handleStatusChange(user.id, "DISABLED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition"
                      >
                        <Ban className="w-3.5 h-3.5" /> Disable
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}