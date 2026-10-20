"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface FinanceData {
  grossSales: number;
  marketplaceFees: number;
  netBalance: number;
  totalPaidOut: number;
  currency: string;
  records: Transaction[];
  pendingPayouts: Payout[];
}

export default function SellerFinancesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/seller/finances");
    }
    if (status === "authenticated") {
      fetchFinances();
    }
  }, [status, router]);

  const fetchFinances = async () => {
    try {
      const res = await fetch("/api/seller/finances");
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        console.error("Failed to fetch finances:", json.error);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayoutRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      const amountStr = formData.get("amount") as string;
      const amount = parseFloat(amountStr);

      if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than 0");
        setIsSubmitting(false);
        return;
      }

      const paymentMethodRaw = formData.get("paymentMethod") as string;
      const paymentMethod =
        paymentMethodRaw === "MOBILE_MONEY" ? "MOBILE_MONEY" : "BANK_TRANSFER";

      const accountName = (formData.get("accountName") as string) || "";
      const accountNumber = (formData.get("accountNumber") as string) || "";
      const bankName = (formData.get("bankName") as string) || "";
      const network = (formData.get("network") as string) || "";

      if (accountName.trim().length < 2) {
        alert("Please enter a valid account name (at least 2 characters)");
        setIsSubmitting(false);
        return;
      }

      if (accountNumber.trim().length < 5) {
        alert("Please enter a valid account number (at least 5 characters)");
        setIsSubmitting(false);
        return;
      }

      const payload = {
        amount,
        paymentMethod,
        paymentDetails: {
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          bankName: bankName.trim() || undefined,
          network: network.trim() || undefined,
        },
      };

      console.log("Sending payout request:", payload);

      const res = await fetch("/api/seller/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to request payout");
      }

      alert("Payout request submitted successfully!");
      form.reset();
      setShowPayoutForm(false);
      fetchFinances();
    } catch (error: any) {
      console.error("Payout request error:", error);
      alert(error.message || "Failed to submit payout request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Failed to load finances. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Finances</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track your earnings and request payouts
          </p>
        </div>
        <button
          onClick={() => setShowPayoutForm(!showPayoutForm)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
        >
          {showPayoutForm ? "Cancel" : "Request Payout"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Sales"
          value={`GH₵ ${(data.grossSales || 0).toFixed(2)}`}
          icon={DollarSign}
          color="text-blue-600"
          bg="bg-blue-100"
        />
        <StatCard
          title="Marketplace Fees"
          value={`GH₵ ${(data.marketplaceFees || 0).toFixed(2)}`}
          icon={TrendingUp}
          color="text-orange-600"
          bg="bg-orange-100"
        />
        <StatCard
          title="Net Earnings"
          value={`GH₵ ${(data.netBalance || 0).toFixed(2)}`}
          icon={Wallet}
          color="text-green-600"
          bg="bg-green-100"
        />
        <StatCard
          title="Total Paid Out"
          value={`GH₵ ${(data.totalPaidOut || 0).toFixed(2)}`}
          icon={CheckCircle}
          color="text-teal-600"
          bg="bg-teal-100"
        />
      </div>

      {/* Payout Request Form */}
      {showPayoutForm && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Request Payout
          </h3>
          <form onSubmit={handlePayoutRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (GHS)
              </label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                max={data.netBalance || 0}
                required
                placeholder="Enter amount"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: GH₵ {(data.netBalance || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                required
                defaultValue="MOBILE_MONEY"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name
              </label>
              <input
                type="text"
                name="accountName"
                required
                placeholder="Full name on account"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                name="accountNumber"
                required
                placeholder="e.g., 0241234567"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Network (for Mobile Money) / Bank Name
              </label>
              <input
                type="text"
                name="network"
                placeholder="e.g., MTN, Vodafone, GCB Bank"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? "Submitting..." : "Submit Payout Request"}
            </button>
          </form>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        {(data.records || []).length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No transactions yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {(data.records || []).map((t) => (
              <div
                key={t.id || t.createdAt}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {t.description || t.type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      t.amount >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {t.amount >= 0 ? "+" : ""}GH₵ {Math.abs(t.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Payouts */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Pending Payouts</h3>
        </div>
        {(data.pendingPayouts || []).length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No pending payouts
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(data.pendingPayouts || []).map((p) => (
              <div
                key={p.id}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    GH₵ {p.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.paymentMethod} •{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bg,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{title}</p>
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}