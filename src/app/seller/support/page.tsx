// src/app/seller/support/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LifeBuoy, Plus, Loader2, X, CheckCircle } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  resolution: string | null;
  createdAt: string;
}

export default function SellerSupportPage() {
  const router = useRouter();
  const { status } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/seller/support");
    if (status === "authenticated") fetchTickets();
  }, [status, router]);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/seller/support");
      const data = await res.json();
      if (res.ok) setTickets(data.tickets);
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: "bg-amber-100 text-amber-800 border-amber-200",
      IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
      RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return styles[status] || styles.OPEN;
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[400px]"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <LifeBuoy className="w-7 h-7" />
            Support & Help
          </h1>
          <p className="text-sm text-gray-500 mt-1">Contact the iBUY admin team for assistance.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <LifeBuoy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No support tickets</h3>
          <p className="text-gray-500 mt-1">Everything running smoothly? Great!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">{ticket.category}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{ticket.subject}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Opened {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(ticket.status)}`}>
                  {ticket.status.replace("_", " ")}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{ticket.message}</p>

              {ticket.resolution && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <p className="text-xs font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Admin Response:
                  </p>
                  <p className="text-sm text-indigo-800 whitespace-pre-wrap">{ticket.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTickets();
          }}
        />
      )}
    </div>
  );
}

function CreateTicketModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ subject: "", message: "", category: "GENERAL", priority: "NORMAL" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/seller/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) onSuccess();
      else setError(data.error || "Failed to create ticket");
    } catch (error) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Contact Support</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="GENERAL">General Inquiry</option>
              <option value="ORDER">Order Issue</option>
              <option value="PAYMENT">Payment / Payout</option>
              <option value="TECHNICAL">Technical Problem</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Payout delay, Account locked..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <textarea
              required
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Please describe your issue in detail..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}