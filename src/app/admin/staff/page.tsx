// src/app/admin/staff/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { UserCog, Shield, Plus, Mail, CheckCircle, XCircle, Clock } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  inviterEmail: string;
  redeemedEmail: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function AdminStaffPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ADMIN");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [devToken, setDevToken] = useState("");

  useEffect(() => {
    if (session?.user?.role === "SUPER_ADMIN") {
      fetchData();
    }
  }, [session, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "members") {
        const res = await fetch("/api/admin/staff");
        const data = await res.json();
        if (res.ok) setStaff(data.staff || []);
      } else {
        const res = await fetch("/api/admin/invitations");
        const data = await res.json();
        if (res.ok) setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setDevToken("");
    setIsInviting(true);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();

      if (res.ok) {
        setInviteEmail("");
        if (data.devRawToken) {
          setDevToken(data.devRawToken);
        }
        fetchData();
      } else {
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch (error) {
      setInviteError("Network error");
    } finally {
      setIsInviting(false);
    }
  };

  if (session?.user?.role !== "SUPER_ADMIN") {
    return (
      <div className="text-center py-16">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">Only Super Admins can manage staff and invitations.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage admin team members and invitations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "members" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Team Members
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "invitations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Invitations
        </button>
      </div>

      {activeTab === "members" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Current Staff ({staff.length})</h3>
          </div>
          {staff.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No staff members yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {staff.map((member) => (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <UserCog className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={member.role} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Invite Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Invite New Staff Member</h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ADMIN">Admin</option>
                <option value="SUPPORT">Support</option>
              </select>
              <button
                type="submit"
                disabled={isInviting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {isInviting ? "Sending..." : "Send Invite"}
              </button>
            </form>
            {inviteError && <p className="text-sm text-red-600 mt-2">{inviteError}</p>}
            {devToken && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
                <p className="font-semibold mb-1">🔑 Development Token (Do not share in production)</p>
                <p className="font-mono text-xs break-all bg-white p-2 rounded border border-yellow-200 mt-1">
                  {devToken}
                </p>
                <p className="mt-2 text-xs">
                  Log in as <strong>{inviteEmail}</strong> and use this token to claim the role.
                </p>
              </div>
            )}
          </div>

          {/* Invitations List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Sent Invitations</h3>
            </div>
            {invitations.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No invitations sent yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {invitations.map((inv) => (
                  <div key={inv.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900">{inv.email}</p>
                        <StatusBadge status={inv.status} size="sm" />
                      </div>
                      <p className="text-xs text-gray-500">
                        Role: {inv.role} • Invited by: {inv.inviterEmail} • Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                      {inv.redeemedEmail && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Redeemed by {inv.redeemedEmail}
                        </p>
      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}