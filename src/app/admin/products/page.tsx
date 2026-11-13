 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Eye,
  Archive,
  CheckCircle,
  Package,
  Clock,
  XCircle,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { StatusBadge, DataTable, Column } from "@/components/dashboard";

interface Product {
  id: string;
  title: string;
  slug: string;
  status: string;
  sellerName: string;
  categoryName: string;
  price: number;
  createdAt: string;
}

interface Submission {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  seller?: { businessName: string } | null;
  category: { name: string };
  images: {
    url: string;
    altText?: string | null;
    isPrimary: boolean;
  }[];
  variants: {
    price: number;
    stockQuantity: number;
    sellerOffers: {
      price: number;
      stockQuantity: number;
      sellerSku?: string | null;
    }[];
  }[];
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeSection, setActiveSection] = useState<"CATALOGUE" | "PENDING">(
    "PENDING"
  );

  useEffect(() => {
    fetchProducts();
  }, [statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();

      if (res.ok) {
        setProducts(
          (data.products || []).filter(
            (product: Product) => product.status !== "PENDING_REVIEW"
          )
        );
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);

    try {
      const res = await fetch("/api/admin/product-submissions");
      const data = await res.json();

      if (res.ok) {
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error("Failed to fetch submissions", error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleStatusChange = async (
    productId: string,
    newStatus: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to change this product's status to ${newStatus}?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchProducts();
      } else {
        alert("Failed to update product.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handleReview = async (
    submission: Submission,
    action: "APPROVE" | "REJECT"
  ) => {
    let reason = "";

    if (action === "APPROVE") {
      if (!confirm(`Approve "${submission.title}" for the marketplace catalogue?`)) {
        return;
      }
    } else {
      const input = prompt(
        `Enter the reason for rejecting "${submission.title}":`
      );

      if (input === null) return;

      reason = input.trim();

      if (reason.length < 5) {
        alert("Please provide a rejection reason of at least 5 characters.");
        return;
      }
    }

    setProcessingId(submission.id);

    try {
      const res = await fetch("/api/admin/product-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: submission.id,
          action,
          ...(action === "REJECT" ? { reason } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to process submission.");
        return;
      }

      alert(
        action === "APPROVE"
          ? "Product approved and added to the catalogue."
          : "Product rejected. Feedback has been recorded."
      );

      await Promise.all([fetchSubmissions(), fetchProducts()]);
    } catch (error) {
      console.error("Product review failed:", error);
      alert("Network error while processing submission.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredProducts = search
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.sellerName.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: "Product",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <Link
              href={`/admin/products/${item.id}`}
              className="font-medium text-indigo-600 hover:underline text-sm block truncate max-w-[200px]"
            >
              {item.title}
            </Link>
            <p className="text-xs text-gray-500 truncate">
              {item.sellerName}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      render: (item) => (
        <span className="text-sm text-gray-700">{item.categoryName}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (item) => (
        <span className="font-semibold text-sm">
          GH₵ {item.price.toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "date",
      header: "Created",
      hideOnMobile: true,
      render: (item) => (
        <span className="text-xs text-gray-600">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/products/${item.id}`}
            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Link>

          {item.status === "ACTIVE" ? (
            <button
              onClick={() => handleStatusChange(item.id, "ARCHIVED")}
              className="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded transition"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          ) : item.status === "ARCHIVED" || item.status === "DRAFT" ? (
            <button
              onClick={() => handleStatusChange(item.id, "ACTIVE")}
              className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
              title="Activate"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Product Moderation
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Review seller submissions and manage the marketplace catalogue.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
        >
          <Package className="w-4 h-4" />
          Create Catalogue Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {products.length}
          </p>
          <p className="text-xs text-gray-500">Catalogue Products</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {products.filter((p) => p.status === "ACTIVE").length}
          </p>
          <p className="text-xs text-gray-500">Active</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            {products.filter((p) => p.status === "DRAFT").length}
          </p>
          <p className="text-xs text-gray-500">Drafts</p>
        </div>

        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <p className="text-2xl font-bold text-orange-600">
            {submissions.length}
          </p>
          <p className="text-xs text-gray-500">Awaiting Review</p>
        </div>
      </div>

      {/* Section navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveSection("PENDING")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeSection === "PENDING"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Submissions
          {submissions.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              {submissions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection("CATALOGUE")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeSection === "CATALOGUE"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Package className="w-4 h-4" />
          Catalogue
        </button>
      </div>

      {/* Pending submissions */}
      {activeSection === "PENDING" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                Seller Product Submissions
              </h3>
              <p className="text-sm text-gray-500">
                Review products before adding them to the shared catalogue.
              </p>
            </div>

            <button
              onClick={fetchSubmissions}
              disabled={isLoadingSubmissions}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title="Refresh submissions"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isLoadingSubmissions ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>

          {isLoadingSubmissions ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">
                Loading submissions...
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
              <h3 className="font-semibold text-gray-900 mt-3">
                All caught up!
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                There are no pending product submissions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {submissions.map((submission) => {
                const offer = submission.variants[0]?.sellerOffers[0];
                const price = offer?.price ?? submission.variants[0]?.price ?? 0;
                const stock =
                  offer?.stockQuantity ??
                  submission.variants[0]?.stockQuantity ??
                  0;

                const image =
                  submission.images.find((img) => img.isPrimary) ??
                  submission.images[0];

                const isProcessing = processingId === submission.id;

                return (
                  <div
                    key={submission.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                  >
                    {/* Product preview */}
                    <div className="flex gap-4 p-4">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                        {image?.url ? (
                          <img
                            src={image.url}
                            alt={image.altText || submission.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-gray-900 leading-snug">
                            {submission.title}
                          </h4>

                          <span className="flex-shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          {submission.category.name}
                        </p>

                        <p className="text-xs text-gray-600 mt-2">
                          Seller:{" "}
                          <span className="font-semibold">
                            {submission.seller?.businessName || "Unknown seller"}
                          </span>
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Submitted{" "}
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Product information */}
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {submission.description}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Seller Price</p>
                          <p className="font-bold text-gray-900 mt-1">
                            GH₵ {price.toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Initial Stock</p>
                          <p className="font-bold text-gray-900 mt-1">
                            {stock} units
                          </p>
                        </div>
                      </div>

                      {offer?.sellerSku && (
                        <p className="text-xs text-gray-500 mt-3">
                          Seller SKU: {offer.sellerSku}
                        </p>
                      )}

                      {/* Images */}
                      {submission.images.length > 1 && (
                        <div className="flex gap-2 mt-4 overflow-x-auto">
                          {submission.images.map((img, index) => (
                            <img
                              key={`${img.url}-${index}`}
                              src={img.url}
                              alt={img.altText || submission.title}
                              className="w-14 h-14 rounded-md object-cover border border-gray-200 flex-shrink-0"
                            />
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-3 mt-5">
                        <button
                          onClick={() =>
                            handleReview(submission, "REJECT")
                          }
                          disabled={isProcessing}
                          className="flex items-center justify-center gap-2 px-3 py-3 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>

                        <button
                          onClick={() =>
                            handleReview(submission, "APPROVE")
                          }
                          disabled={isProcessing}
                          className="flex items-center justify-center gap-2 px-3 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {isProcessing ? "Processing..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Existing catalogue management */}
      {activeSection === "CATALOGUE" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by product name or seller..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={fetchProducts}
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh catalogue
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              emptyMessage="No products found matching your criteria."
            />
          )}
        </div>
      )}
    </div>
  );
}