// src/app/admin/disputes/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

interface Dispute {
  id: string;
  orderId: string;
  orderTotal: number;
  subject: string;
  description: string;
  status: string;
  resolution?: string | null;
  refundAmount?: number | null;
  raisedByName: string;
  raisedByEmail: string;
  sellerName: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [resolveModal, setResolveModal] = useState<Dispute | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState("RESOLVED_CUSTOMER");
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const res = await fetch("/api/admin/disputes");
      const data = await res.json();
      if (res.ok) setDisputes(data.disputes || []);
    } catch (error) {
      console.error("Failed to fetch disputes", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${resolveModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        }),
      });
      if (res.ok) {
        setResolveModal(null);
        setResolution("");
        setRefundAmount("");
        fetchDisputes();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDisputes = statusFilter
    ? disputes.filter((d) => d.status === statusFilter)
    : disputes;

  const openCount = disputes.filter((d) => d.status === "OPEN").length;

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
        <h2 className="text-2xl font-bold text-gray-900">Dispute Resolution</h2>
        <p className="text-sm text-gray-500 mt-1">
          Handle customer-seller disputes fairly and transparently
        </p>
      </div>

      {openCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-700 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">{openCount} open dispute(s) need attention</p>
            <p className="text-sm text-red-800">Resolve these promptly to maintain marketplace trust.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {["", "OPEN", "UNDER_REVIEW", "RESOLVED_CUSTOMER", "RESOLVED_SELLER", "CLOSED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status || "All"} {status && `(${disputes.filter((d) => d.status === status).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No disputes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{dispute.subject}</p>
                    <StatusBadge status={dispute.status} />
                  </div>
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">{dispute.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">Raised by:</span>{" "}
                      <strong>{dispute.raisedByName}</strong> ({dispute.raisedByEmail})
                    </div>
                    <div>
                      <span className="text-gray-500">Against:</span>{" "}
                      <strong>{dispute.sellerName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Order total:</span>{" "}
                      <strong>GH₵ {dispute.orderTotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Opened:</span>{" "}
                      {new Date(dispute.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {dispute.resolution && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="text-xs text-gray-500 mb-1">Resolution:</p>
                      <p className="text-gray-800">{dispute.resolution}</p>
                      {dispute.refundAmount && (
                        <p className="text-xs text-indigo-600 font-semibold mt-1">
                          Refund: GH₵ {dispute.refundAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {(dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") && (
                  <button
                    onClick={() => setResolveModal(dispute)}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition self-start"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Resolve Dispute</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{resolveModal.subject}</strong> — raised by {resolveModal.raisedByName}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Resolution Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="RESOLVED_CUSTOMER">Resolved in Favor of Customer (Refund)</option>
                  <option value="RESOLVED_SELLER">Resolved in Favor of Seller (No Refund)</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Resolution Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  required
                  placeholder="Explain your decision..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {resolutionStatus === "RESOLVED_CUSTOMER" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Refund Amount (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={resolveModal.orderTotal}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Up to ${resolveModal.orderTotal.toFixed(2)}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Order total: GH₵ {resolveModal.orderTotal.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setResolveModal(null);
                    setResolution("");
                    setRefundAmount("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isSubmitting || !resolution.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Resolving..." : "Confirm Resolution"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}