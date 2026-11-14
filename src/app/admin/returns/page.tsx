 "use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  RefreshCw,
  PackageCheck,
  CheckCircle,
  XCircle,
  Truck,
  Wallet,
} from "lucide-react";

interface ReturnRequest {
  id: string;
  orderId: string;
  orderItemId: string;
  reason: string;
  quantity: number;
  status: string;
  reviewNote?: string | null;
  refundAmount?: number | string | null;
  createdAt: string;
  refundOperationId?: string | null;
  reviewedAt?: string | null;
  receivedAt?: string | null;
  order: {
    totalAmount: number | string;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      phone?: string | null;
    };
  };
  orderItem: {
    title: string;
    quantity: number;
    price: number | string;
    status: string;
  };
  refundOperation?: {
    id: string;
    status: string;
    amount: number | string;
  } | null;
}

const statuses = [
  "ALL",
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "REFUNDED",
];

export default function AdminReturnsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);

    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/returns${query}`);
      const data = await res.json();

      if (res.ok) setReturns(data.returns || []);
      else alert(data.error || "Unable to load returns.");
    } catch {
      alert("Unable to load return requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (session?.user?.role === "SUPER_ADMIN") fetchReturns();
  }, [session, fetchReturns]);

  const performAction = async (
    item: ReturnRequest,
    action: "APPROVE" | "REJECT" | "RECEIVE" | "REFUND"
  ) => {
    const labels = {
      APPROVE: "approve this return",
      REJECT: "reject this return",
      RECEIVE: "confirm that this item has physically been received",
      REFUND: "initiate a refund for this return",
    };

    if (!window.confirm(`Are you sure you want to ${labels[action]}?`)) return;

    const reviewNote =
      action === "APPROVE" || action === "REJECT" || action === "RECEIVE"
        ? window.prompt("Review note (optional):") || ""
        : "";

    setBusyId(item.id);

    try {
      const isRefund = action === "REFUND";

      const res = await fetch(
        isRefund
          ? `/api/admin/returns/${item.id}/refund`
          : `/api/admin/returns/${item.id}`,
        {
          method: isRefund ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(isRefund
            ? {}
            : { body: JSON.stringify({ action, reviewNote }) }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Action failed.");
      } else {
        alert(data.message || "Action completed.");
        await fetchReturns();
      }
    } catch {
      alert("Unable to complete the action.");
    } finally {
      setBusyId(null);
    }
  };

  if (sessionStatus === "loading") {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (session?.user?.role !== "SUPER_ADMIN") {
    return (
      <div className="p-8 text-center text-red-600">
        Access denied. Super Admin only.
      </div>
    );
  }

  const formatMoney = (value: number | string) =>
    `GH₵ ${Number(value).toFixed(2)}`;

  const customerName = (item: ReturnRequest) =>
    `${item.order.user.firstName || ""} ${item.order.user.lastName || ""}`.trim() ||
    item.order.user.email;

  const statusStyle: Record<string, string> = {
    REQUESTED: "bg-amber-100 text-amber-800",
    APPROVED: "bg-blue-100 text-blue-800",
    REJECTED: "bg-red-100 text-red-800",
    RECEIVED: "bg-purple-100 text-purple-800",
    REFUNDED: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Returns Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review returned items and manage customer refunds.
          </p>
        </div>

        <button
          onClick={fetchReturns}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              filter === status
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status === "ALL" ? "All Returns" : status}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white">
        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading return requests...
          </div>
        ) : returns.length === 0 ? (
          <div className="p-10 text-center">
            <PackageCheck className="mx-auto mb-3 text-gray-400" size={36} />
            <p className="font-medium text-gray-700">No return requests found</p>
            <p className="mt-1 text-sm text-gray-500">
              Requests matching this filter will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {returns.map((item) => (
              <div key={item.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {item.orderItem.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Return ID: {item.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      Order: {item.orderId}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyle[item.status] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-gray-500">Customer</p>
                    <p className="font-medium">{customerName(item)}</p>
                    <p className="text-xs text-gray-500">
                      {item.order.user.phone || item.order.user.email}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Return reason</p>
                    <p className="font-medium">
                      {item.reason.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-medium">
                      {item.quantity} of {item.orderItem.quantity}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Item price</p>
                    <p className="font-medium">
                      {formatMoney(item.orderItem.price)}
                    </p>
                  </div>
                </div>

                {item.reviewNote && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <span className="font-medium">Review note: </span>
                    {item.reviewNote}
                  </div>
                )}

                {item.refundOperation && (
                  <div className="rounded-lg bg-green-50 p-3 text-sm">
                    <p className="font-medium text-green-800">
                      Refund operation: {item.refundOperation.status}
                    </p>
                    <p className="text-green-700">
                      {formatMoney(item.refundOperation.amount)}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {item.status === "REQUESTED" && (
                    <>
                      <button
                        disabled={busyId === item.id}
                        onClick={() => performAction(item, "APPROVE")}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        <CheckCircle size={15} /> Approve
                      </button>

                      <button
                        disabled={busyId === item.id}
                        onClick={() => performAction(item, "REJECT")}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        <XCircle size={15} /> Reject
                      </button>
                    </>
                  )}

                  {item.status === "APPROVED" && (
                    <button
                      disabled={busyId === item.id}
                      onClick={() => performAction(item, "RECEIVE")}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      <Truck size={15} /> Confirm Received
                    </button>
                  )}

                  {item.status === "RECEIVED" && !item.refundOperationId && (
                    <button
                      disabled={busyId === item.id}
                      onClick={() => performAction(item, "REFUND")}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      <Wallet size={15} /> Initiate Refund
                    </button>
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