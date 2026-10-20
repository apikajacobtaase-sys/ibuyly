// src/app/admin/sellers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  PauseCircle,
  Clock,
  Loader2,
  Mail,
  Phone,
  Package,
  Store,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

interface Seller {
  id: string;
  businessName: string;
  businessType: string | null;
  description: string | null;
  logoUrl: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  isActive: boolean;
  commissionRate: number;
  createdAt: string;
  productCount: number;
  owner: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    fullName: string;
  };
}

const STATUS_TABS = [
  { value: "ALL", label: "All", icon: Users },
  { value: "PENDING", label: "Pending", icon: Clock, color: "amber" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, color: "emerald" },
  { value: "REJECTED", label: "Rejected", icon: XCircle, color: "rose" },
  { value: "SUSPENDED", label: "Suspended", icon: PauseCircle, color: "orange" },
];

export default function AdminSellersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({
    ALL: 0,
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    SUSPENDED: 0,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [sellerToReject, setSellerToReject] = useState<Seller | null>(null);

  const currentStatus = searchParams.get("status") || "ALL";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const searchQuery = searchParams.get("q") || "";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin/sellers");
    }
    if (status === "authenticated") {
      fetchSellers();
    }
  }, [status, router, currentStatus, currentPage, searchQuery]);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });
      if (currentStatus !== "ALL") params.set("status", currentStatus);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/admin/sellers?${params}`);
      const data = await res.json();

      if (res.ok) {
        setSellers(data.sellers);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setCounts(data.counts);
      } else {
        console.error("Failed to fetch sellers:", data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    params.set("page", "1");
    router.push(`/admin/sellers?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.push(`/admin/sellers?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/sellers?${params.toString()}`);
  };

  const handleApprove = async (seller: Seller) => {
    if (!confirm(`Approve "${seller.businessName}" as a verified seller?`)) return;

    setUpdatingId(seller.id);
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, status: "VERIFIED" }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${seller.businessName} has been approved!`);
        fetchSellers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  const openRejectModal = (seller: Seller) => {
    setSellerToReject(seller);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!sellerToReject) return;

    setUpdatingId(sellerToReject.id);
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: sellerToReject.id,
          status: "REJECTED",
          reason: rejectReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`❌ ${sellerToReject.businessName} has been rejected.`);
        setShowRejectModal(false);
        setSellerToReject(null);
        fetchSellers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSuspend = async (seller: Seller) => {
    if (!confirm(`Suspend "${seller.businessName}"? They will not be able to sell.`)) return;

    setUpdatingId(seller.id);
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, status: "SUSPENDED" }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`⚠️ ${seller.businessName} has been suspended.`);
        fetchSellers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReactivate = async (seller: Seller) => {
    if (!confirm(`Reactivate "${seller.businessName}"?`)) return;

    setUpdatingId(seller.id);
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, status: "VERIFIED" }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${seller.businessName} has been reactivated.`);
        fetchSellers();
      } else {
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
      VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
      SUSPENDED: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return styles[status] || styles.PENDING;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED": return <CheckCircle className="w-3.5 h-3.5" />;
      case "REJECTED": return <XCircle className="w-3.5 h-3.5" />;
      case "SUSPENDED": return <PauseCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7" />
          Seller Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review, approve, and manage seller accounts
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search by business name, owner email, or description..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </form>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.value] || 0;
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
              <span
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  currentStatus === tab.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sellers List */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No sellers found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery
              ? `No sellers match "${searchQuery}".`
              : `No sellers with "${currentStatus}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller) => (
            <div
              key={seller.id}
              className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Logo & Business Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {seller.logoUrl ? (
                    <img
                      src={seller.logoUrl}
                      alt={seller.businessName}
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                      <Store className="w-6 h-6 text-slate-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {seller.businessName}
                      </h3>
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusBadge(
                          seller.verificationStatus
                        )}`}
                      >
                        {getStatusIcon(seller.verificationStatus)}
                        {seller.verificationStatus}
                      </span>
                    </div>

                    {seller.businessType && (
                      <p className="text-xs text-gray-500 mb-1">
                        {seller.businessType}
                      </p>
                    )}

                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {seller.description || "No description provided."}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {seller.owner.email}
                      </span>
                      {seller.owner.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {seller.owner.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {seller.productCount} product{seller.productCount !== 1 ? "s" : ""}
                      </span>
                      <span>
                        Joined{" "}
                        {new Date(seller.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex sm:flex-col gap-2 sm:border-l sm:border-gray-100 sm:pl-4">
                  <button
                    onClick={() => setSelectedSeller(seller)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>

                  {seller.verificationStatus === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleApprove(seller)}
                        disabled={updatingId === seller.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {updatingId === seller.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(seller)}
                        disabled={updatingId === seller.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {seller.verificationStatus === "VERIFIED" && (
                    <button
                      onClick={() => handleSuspend(seller)}
                      disabled={updatingId === seller.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {updatingId === seller.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5" />
                      )}
                      Suspend
                    </button>
                  )}

                  {(seller.verificationStatus === "REJECTED" ||
                    seller.verificationStatus === "SUSPENDED") && (
                    <button
                      onClick={() => handleReactivate(seller)}
                      disabled={updatingId === seller.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {updatingId === seller.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Seller Detail Modal */}
      {selectedSeller && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedSeller(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {selectedSeller.logoUrl ? (
                  <img
                    src={selectedSeller.logoUrl}
                    alt={selectedSeller.businessName}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <Store className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedSeller.businessName}
                  </h3>
                  {selectedSeller.businessType && (
                    <p className="text-sm text-gray-500">
                      {selectedSeller.businessType}
                    </p>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border mt-2 ${getStatusBadge(
                      selectedSeller.verificationStatus
                    )}`}
                  >
                    {getStatusIcon(selectedSeller.verificationStatus)}
                    {selectedSeller.verificationStatus}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSeller(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Owner Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Business Owner
                </h4>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    {selectedSeller.owner.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedSeller.owner.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedSeller.owner.email}
                      {selectedSeller.owner.phone && ` • ${selectedSeller.owner.phone}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  About the Business
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedSeller.description || "No description provided."}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Products</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedSeller.productCount}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Commission Rate</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedSeller.commissionRate}%
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Joined</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(selectedSeller.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Verified At</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedSeller.verifiedAt
                      ? new Date(selectedSeller.verifiedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-2">
              {selectedSeller.verificationStatus === "PENDING" && (
                <>
                  <button
                    onClick={() => {
                      handleApprove(selectedSeller);
                      setSelectedSeller(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Seller
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSeller(null);
                      openRejectModal(selectedSeller);
                    }}
                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {selectedSeller.verificationStatus === "VERIFIED" && (
                <button
                  onClick={() => {
                    handleSuspend(selectedSeller);
                    setSelectedSeller(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                >
                  <PauseCircle className="w-4 h-4" />
                  Suspend Seller
                </button>
              )}
              {(selectedSeller.verificationStatus === "REJECTED" ||
                selectedSeller.verificationStatus === "SUSPENDED") && (
                <button
                  onClick={() => {
                    handleReactivate(selectedSeller);
                    setSelectedSeller(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Reactivate Seller
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && sellerToReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Reject Seller Application
                  </h3>
                  <p className="text-sm text-gray-500">
                    {sellerToReject.businessName}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="e.g., Incomplete business information, invalid documents..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                This reason will be shared with the seller via notification.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={updatingId === sellerToReject.id}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {updatingId === sellerToReject.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}