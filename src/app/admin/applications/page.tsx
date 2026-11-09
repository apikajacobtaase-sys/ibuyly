"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Store,
  Mail,
} from "lucide-react";

interface Application {
  id: string;
  businessName: string;
  businessType: string | null;
  description: string | null;
  status: string;
  userEmail: string;
  userName: string;
  hasSellerProfile: boolean;
  createdAt: string;
  reviewedAt: string | null;
}

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "NEEDS_INFO", label: "Needs information" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 ring-blue-200",
  NEEDS_INFO: "bg-orange-50 text-orange-700 ring-orange-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-700 ring-gray-200"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/applications", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load applications.");
      }

      setApplications(data.applications || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "A network error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      ALL: applications.length,
    };

    for (const filter of FILTERS) {
      if (filter.value !== "ALL") {
        result[filter.value] = applications.filter(
          (application) => application.status === filter.value
        ).length;
      }
    }

    return result;
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesStatus =
        activeFilter === "ALL" ||
        application.status === activeFilter;

      const matchesSearch =
        !query ||
        application.businessName.toLowerCase().includes(query) ||
        application.userName.toLowerCase().includes(query) ||
        application.userEmail.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [applications, activeFilter, search]);

  const pendingCount =
    (counts.PENDING || 0) +
    (counts.UNDER_REVIEW || 0) +
    (counts.NEEDS_INFO || 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <ClipboardList className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              Seller Applications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and manage seller onboarding requests.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchApplications()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Total applications</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {applications.length}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Awaiting action</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {pendingCount}
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-1">
          <p className="text-xs font-medium text-emerald-700">Approved</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {counts.APPROVED || 0}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <label
          htmlFor="application-search"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Search applications
        </label>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            id="application-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Business, applicant or email..."
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold transition ${
                activeFilter === filter.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeFilter === filter.value
                    ? "bg-white/20 text-white"
                    : "bg-white text-gray-600"
                }`}
              >
                {counts[filter.value] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Unable to load applications</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={() => void fetchApplications()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Loading applications...</p>
        </div>
      ) : !error && filteredApplications.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-5 text-center">
          <ClipboardList className="h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-semibold text-gray-900">
            No applications found
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {search || activeFilter !== "ALL"
              ? "Try changing your search or status filter."
              : "Seller applications will appear here when applicants submit them."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {filteredApplications.length}
              </span>{" "}
              {filteredApplications.length === 1
                ? "application"
                : "applications"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredApplications.map((application) => (
              <article
                key={application.id}
                className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <Store className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="break-words font-semibold text-gray-900">
                        {application.businessName}
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {application.businessType || "Business type not specified"}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={application.status} />
                </div>

                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                    <ClipboardList className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">
                      {application.userName || "Unnamed applicant"}
                    </span>
                  </p>

                  <p className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="break-all">
                      {application.userEmail}
                    </span>
                  </p>

                  <p className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-4 w-4 shrink-0" />
                    Applied{" "}
                    {new Date(application.createdAt).toLocaleDateString(
                      "en-GH",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {application.status === "APPROVED" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : application.status === "REJECTED" ? (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                    {application.hasSellerProfile
                      ? "Seller profile exists"
                      : "No seller profile"}
                  </div>

                  <Link
                    href={`/admin/applications/${application.id}`}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
                  >
                    <Eye className="h-4 w-4" />
                    Review application
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}