// src/app/admin/payments/page.tsx
"use client";

import { useEffect, useState } from "react";
import { StatusBadge, DataTable, Column } from "@/components/dashboard";

interface Payment {
  id: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  providerTransactionId?: string | null;
  customerEmail: string;
  customerName: string;
  orderTotal: number;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, providerFilter]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (providerFilter) params.set("provider", providerFilter);
      const res = await fetch(`/api/admin/payments?${params}`);
      const data = await res.json();
      if (res.ok) setPayments(data.payments || []);
    } catch (error) {
      console.error("Failed to fetch payments", error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "id",
      header: "Payment ID",
      render: (item) => (
        <span className="font-mono text-xs">{item.id.slice(-8).toUpperCase()}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (item) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{item.customerName || "Unnamed"}</p>
          <p className="text-xs text-gray-500">{item.customerEmail}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (item) => (
        <span className="font-semibold">
          GH₵ {item.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      hideOnMobile: true,
      render: (item) => (
        <span className="text-xs font-medium text-gray-700">{item.provider}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "date",
      header: "Date",
      hideOnMobile: true,
      render: (item) => (
        <span className="text-xs text-gray-600">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  // Calculate summary stats
  const successful = payments.filter((p) => p.status === "SUCCESSFUL");
  const failed = payments.filter((p) => p.status === "FAILED");
  const totalProcessed = successful.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Monitor and investigate payment transactions
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Successful</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{successful.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{failed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Processed</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">GH₵ {totalProcessed.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SUCCESSFUL">Successful</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Providers</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="FLUTTERWAVE">Flutterwave</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          keyExtractor={(item) => item.id}
          emptyMessage="No payments found matching your criteria."
        />
      )}
    </div>
  );
}