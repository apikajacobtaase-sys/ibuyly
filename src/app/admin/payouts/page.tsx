// src/app/admin/payouts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Wallet,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  AlertTriangle,
  X,
} from "lucide-react";

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  paidAt: string | null;
  seller: {
    businessName: string;
    email: string;
  };
}

const STATUS_TABS = [
  { value: "ALL", label: "All", icon: Wallet },
  { value: "PENDING", label: "Pending", icon: Clock, color: "amber" },
  { value: "APPROVED", label: "Approved", icon: CheckCircle, color: "blue" },
  { value: "PAID", label: "Paid", icon: Banknote, color: "emerald" },
  { value: "REJECTED", label: "Rejected", icon: XCircle, color: "rose" },
];

export default function AdminPayoutsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ payout: Payout; action: string } | null>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  const currentStatus = searchParams.get("status") || "ALL";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/admin/payouts");
    if (status === "authenticated") fetchPayouts();
  }, [status, router, currentStatus]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentStatus !== "ALL") params.set("status", currentStatus);
      const res = await fetch(`/api/admin/payouts?${params}`);
      const data = await res.json();
      if (res.ok) setPayouts(data.payouts);
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") params.delete("status");
    else params.set("status", status);
    router.push(`/admin/payouts?${params.toString()}`);
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setUpdatingId(actionModal.payout.id);

    const body: any = {
      payoutId: actionModal.payout.id,
      status: actionModal.action,
    };

    if (actionModal.action === "PAID") body.paymentReference = reference;
    if (actionModal.action === "REJECTED") body.rejectionReason = reason;

    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setActionModal(null);
        setReference("");
        setReason("");
        fetchPayouts();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-800 border-amber-200",
      APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
      PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-200",
      PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
      REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
      FAILED: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return styles[status] || styles.PENDING;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-7 h-7" />
          Payout Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">Review and process seller withdrawals</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => handleTabClick(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                currentStatus === tab.value
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Payouts Table */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
        </div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No payouts found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Seller</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Method</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Requested</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{payout.seller.businessName}</p>
                      <p className="text-xs text-gray-500">{payout.seller.email}</p>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900">
                      {formatCurrency(payout.amount)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{payout.paymentMethod || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {new Date(payout.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {payout.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setActionModal({ payout, action: "APPROVED" })}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setActionModal({ payout, action: "REJECTED" })}
                            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payout.status === "APPROVED" && (
                        <button
                          onClick={() => setActionModal({ payout, action: "PAID" })}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                      {(payout.status === "PAID" || payout.status === "REJECTED") && (
                        <span className="text-xs text-gray-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {actionModal.action === "APPROVED" && "Approve Payout"}
                {actionModal.action === "PAID" && "Mark as Paid"}
                {actionModal.action === "REJECTED" && "Reject Payout"}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                {actionModal.action === "APPROVED" && `Approve GH₵ ${actionModal.payout.amount.toFixed(2)} for ${actionModal.payout.seller.businessName}?`}
                {actionModal.action === "PAID" && `Confirm that GH₵ ${actionModal.payout.amount.toFixed(2)} has been sent to ${actionModal.payout.seller.businessName}.`}
                {actionModal.action === "REJECTED" && `Reject the payout request for GH₵ ${actionModal.payout.amount.toFixed(2)}?`}
              </p>

              {actionModal.action === "PAID" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction Reference</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g., MoMo Transaction ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {actionModal.action === "REJECTED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for Rejection</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g., Insufficient balance, suspicious activity..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-2">
              <button onClick={() => setActionModal(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={updatingId === actionModal.payout.id}
                className={`flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionModal.action === "REJECTED" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {updatingId === actionModal.payout.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}