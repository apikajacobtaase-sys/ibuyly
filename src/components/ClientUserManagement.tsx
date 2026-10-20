// src/components/ClientUserManagement.ts
"use client";

import { useState } from "react";
import { Users, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  createdAt: Date;
}

export default function ClientUserManagement({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

   const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // 👇 We now send 'role' which the merged API will process
        body: JSON.stringify({ role: newRole }), 
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `User role updated to ${newRole}` });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update role" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error occurred" });
    } finally {
      setUpdatingId(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage user roles and permissions
          </p>
        </div>
      </div>

            {/* Feedback Message (Highly Visible) */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{message.type === "success" ? "Success!" : "Error"}</p>
            <p className="text-sm mt-1">{message.text}</p>
          </div>
          <button 
            onClick={() => setMessage(null)} 
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}
      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Current Role</th>
              <th className="px-6 py-3 text-left font-medium">Change Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-6 py-4 text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.role === "SUPER_ADMIN" ? "bg-purple-100 text-purple-700" :
                    user.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                    user.role === "SELLER" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {user.role}
                  </span>
                </td>
                                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={updatingId === user.id}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                  >
                    {/* 👇 FIX: Values now exactly match your Prisma enum */}
                    <option value="CUSTOMER">Customer</option>
                    <option value="SELLER_OWNER">Seller Owner</option>
                    <option value="SELLER_STAFF">Seller Staff</option>
                    <option value="SUPPORT">Support</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                  {updatingId === user.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 inline ml-2" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}