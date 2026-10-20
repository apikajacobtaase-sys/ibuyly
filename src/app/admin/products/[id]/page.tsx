// src/app/admin/products/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Store, Package, Tag, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

export default function AdminProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (params.id) fetchProduct();
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/admin/products/${params.id}`);
      const data = await res.json();
      if (res.ok) {
        setProduct(data.product);
        setNewStatus(data.product.status);
      } else {
        router.push("/admin/products");
      }
    } catch (error) {
      console.error("Failed to fetch product", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModerate = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, feedback: feedback.trim() || undefined }),
      });
      if (res.ok) {
        alert("✅ Product status updated");
        fetchProduct();
        setFeedback("");
      } else {
        alert("❌ Failed to update");
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!product) return null;

  const variant = product.variants[0];
  const primaryImage = product.images.find((img: any) => img.isPrimary) || product.images[0];

  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{product.title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {product.category.name} • {product._count.reviews} reviews
          </p>
        </div>
        <StatusBadge status={product.status} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
              {primaryImage ? (
                <Image src={primaryImage.url} alt={product.title} fill className="object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">📦</div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((img: any) => (
                  <div key={img.id} className="relative w-16 h-16 flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden">
                    <Image src={img.url} alt="" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
          </div>

          {/* Variants */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Variants & Inventory</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.variants.map((v: any) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                      <td className="px-3 py-2 font-semibold">GH₵ {parseFloat(v.price.toString()).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={v.stockQuantity <= 5 ? "text-red-600 font-semibold" : ""}>
                          {v.stockQuantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Seller & Moderation */}
        <div className="space-y-6">
          {/* Seller Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Seller</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Business Name</p>
                <p className="font-medium text-gray-900">{product.seller.businessName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900 break-all">{product.seller.user.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Verification</p>
                <StatusBadge status={product.seller.verificationStatus} />
              </div>
            </div>
          </div>

          {/* Moderation Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Moderation</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ACTIVE">Active (Visible to customers)</option>
                  <option value="DRAFT">Draft (Hidden)</option>
                  <option value="ARCHIVED">Archived (Removed from listings)</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Feedback to Seller (Optional)
                </label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Explain the moderation decision..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleModerate}
                disabled={isUpdating || newStatus === product.status}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : "Apply Moderation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}