// src/app/admin/support/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LifeBuoy, Loader2, X, CheckCircle, MessageSquare } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  resolution: string | null;
  createdAt: string;
  user: { email: string; firstName: string | null; lastName: string | null } | null;
}

export default function AdminSupportPage() {
  const router = useRouter();
  const { status } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyModal, setReplyModal] = useState<Ticket | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/admin/support");
    if (status === "authenticated") fetchTickets();
  }, [status, router]);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/admin/support");
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
    return <div className="flex justify-center items-center min-h-[400px]"><Loader2 className="w-8 h-8 text-slate-800 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <LifeBuoy className="w-7 h-7" />
          Support Inbox
        </h1>
        <p className="text-sm text-gray-500 mt-1">Review and respond to user & seller support tickets.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <LifeBuoy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Inbox Zero!</h3>
          <p className="text-gray-500 mt-1">No support tickets at the moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-medium">User</th>
                <th className="px-5 py-3 text-left font-medium">Subject</th>
                <th className="px-5 py-3 text-left font-medium">Category</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{[ticket.user?.firstName, ticket.user?.lastName].filter(Boolean).join(" ") || "User"}</p>
                    <p className="text-xs text-gray-500">{ticket.user?.email}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-700 max-w-xs truncate">{ticket.subject}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">{ticket.category}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(ticket.status)}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setReplyModal(ticket)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 transition-colors ml-auto"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {ticket.resolution ? "Update" : "Reply"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {replyModal && (
        <ReplyModal
          ticket={replyModal}
          onClose={() => setReplyModal(null)}
          onSuccess={() => {
            setReplyModal(null);
            fetchTickets();
          }}
        />
      )}
    </div>
  );
}

function ReplyModal({ ticket, onClose, onSuccess }: { ticket: Ticket; onClose: () => void; onSuccess: () => void }) {
  const [resolution, setResolution] = useState(ticket.resolution || "");
  const [status, setStatus] = useState(ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, resolution, status }),
      });

      if (res.ok) onSuccess();
      else alert("Failed to update ticket");
    } catch (error) {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Ticket: {ticket.subject}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Original Message */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">ORIGINAL MESSAGE:</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.message}</p>
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Resolution / Reply</label>
              <textarea
                required
                rows={5}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Type your response to the user..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Update Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><CheckCircle className="w-4 h-4" /> Send & Update</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}