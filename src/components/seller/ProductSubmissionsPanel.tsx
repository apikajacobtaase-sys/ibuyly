 "use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Package, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Submission {
  id: string;
  title: string;
  slug: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  category: { name: string };
  variants: {
    price: number;
    stockQuantity: number;
    sellerOffers: {
      status: string;
      price: number;
      stockQuantity: number;
    }[];
  }[];
  images: {
    url: string;
    altText: string | null;
    isPrimary: boolean;
  }[];
}

const statusConfig: Record<string, {
  label: string;
  className: string;
  icon: typeof Clock;
}> = {
  PENDING_REVIEW: {
    label: "Pending Review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  ACTIVE: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  OUT_OF_STOCK: {
    label: "Approved — Out of Stock",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
};

export default function ProductSubmissionsPanel() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/seller/product-submissions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load submissions.");
      }

      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load submissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(price);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div>
          <h3 className="font-semibold text-gray-900">
            My Product Submissions
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Track products submitted for catalogue approval.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSubmissions}
          disabled={loading}
          className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading submissions...
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Package className="mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-800">
              No product submissions yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Products you submit for approval will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const status =
                statusConfig[submission.status] || statusConfig.PENDING_REVIEW;
              const StatusIcon = status.icon;
              const variant = submission.variants[0];
              const image = submission.images[0];

              return (
                <article
                  key={submission.id}
                  className="rounded-xl border border-gray-200 p-3 sm:p-4"
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {image?.url ? (
                        <img
                          src={image.url}
                          alt={image.altText || submission.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                          <Package className="h-7 w-7" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-gray-900">
                        {submission.title}
                      </h4>

                      <p className="mt-1 text-xs text-gray-500">
                        {submission.category?.name || "Uncategorized"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <span>
                      Price:{" "}
                      <strong className="text-gray-800">
                        {variant ? formatPrice(variant.price) : "—"}
                      </strong>
                    </span>

                    <span>
                      Stock:{" "}
                      <strong className="text-gray-800">
                        {variant?.stockQuantity ?? 0}
                      </strong>
                    </span>

                    <span>
                      Submitted:{" "}
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {submission.status === "REJECTED" && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        Administrator feedback
                      </div>
                      <p className="mt-1 text-sm text-red-700">
                        {submission.reviewNote ||
                          "No additional feedback was provided."}
                      </p>
                    </div>
                  )}

                  {submission.status === "PENDING_REVIEW" && (
                    <p className="mt-3 text-xs text-amber-700">
                      Your product is awaiting administrator review. It will
                      not appear in the public catalogue until approved.
                    </p>
                  )}

                  {(submission.status === "ACTIVE" ||
                    submission.status === "OUT_OF_STOCK") && (
                    <p className="mt-3 text-xs text-green-700">
                      Your product has been approved and added to the iBUY
                      catalogue.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}