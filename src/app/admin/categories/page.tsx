// src/app/admin/categories/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FolderTree,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Package,
  Layers,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  parentId: string | null;
  parentName: string | null;
  productCount: number;
  childCount: number;
  createdAt: string;
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { status } = useSession();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin/categories");
    }
    if (status === "authenticated") {
      fetchCategories();
    }
  }, [status, router]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories);
      } else {
        console.error("Failed to fetch categories:", data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: category.id,
          isActive: !category.isActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        fetchCategories();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reassignToCategoryId: string | null) => {
    if (!selectedCategory) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          reassignToCategoryId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Category deleted successfully${data.reassignedProducts > 0 ? ` (${data.reassignedProducts} products reassigned)` : ""}`);
        setShowDeleteModal(false);
        setSelectedCategory(null);
        fetchCategories();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FolderTree className="w-7 h-7" />
            Category Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Organize your product catalog
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Category
        </button>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <FolderTree className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No categories yet</h3>
          <p className="text-gray-500 mt-1">
            Create your first category to start organizing products.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Category</th>
                <th className="px-5 py-3 text-left font-medium">Parent</th>
                <th className="px-5 py-3 text-center font-medium">Products</th>
                <th className="px-5 py-3 text-center font-medium">Subcategories</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {category.imageUrl ? (
                        <img
                          src={category.imageUrl}
                          alt={category.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <FolderTree className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{category.name}</p>
                        <p className="text-xs text-gray-500 font-mono">/{category.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {category.parentName || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                      <Package className="w-3 h-3" />
                      {category.productCount}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded">
                      <Layers className="w-3 h-3" />
                      {category.childCount}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggleActive(category)}
                      disabled={submitting}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        category.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {category.isActive ? (
                        <>
                          <Eye className="w-3 h-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          Hidden
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <CategoryFormModal
          category={showEditModal ? selectedCategory : null}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedCategory(null);
            fetchCategories();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCategory && (
        <DeleteCategoryModal
          category={selectedCategory}
          categories={categories.filter((c) => c.id !== selectedCategory.id)}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCategory(null);
          }}
          onConfirm={handleDelete}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// ==========================================
// Category Form Modal Component
// ==========================================

function CategoryFormModal({
  category,
  categories,
  onClose,
  onSuccess,
}: {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    parentId: category?.parentId || "",
    imageUrl: category?.imageUrl || "",
    isActive: category?.isActive ?? true, // 👈 Added isActive (defaults to true/Public)
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!category;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || !formData.slug.trim()) {
      setError("Name and slug are required");
      return;
    }

    setSubmitting(true);

    try {
      const url = "/api/admin/categories";
      const method = isEdit ? "PATCH" : "POST";
      
      // 👈 FIX: Removed 'description', added 'isActive'
      const body = isEdit
        ? {
            categoryId: category.id,
            name: formData.name,
            slug: formData.slug,
            parentId: formData.parentId || null,
            imageUrl: formData.imageUrl || null,
            isActive: formData.isActive,
          }
        : {
            name: formData.name,
            slug: formData.slug,
            parentId: formData.parentId || null,
            imageUrl: formData.imageUrl || null,
            isActive: formData.isActive,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        // Show detailed validation errors if they exist
        const errorMsg = data.details 
          ? Object.values(data.details).flat().join(", ") 
          : (data.error || "Failed to save category");
        setError(errorMsg);
      }
    } catch (error) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit Category" : "Create Category"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                setFormData({
                  ...formData,
                  name,
                  slug: isEdit ? formData.slug : generateSlug(name),
                });
              }}
              placeholder="e.g., Electronics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Slug <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., electronics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              URL-friendly identifier (lowercase, hyphens only)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Parent Category
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="">None (Top-level)</option>
              {categories
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 👈 NEW: Status Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 text-slate-800 rounded focus:ring-slate-500 border-gray-300"
            />
            <div className="flex flex-col">
              <label htmlFor="isActive" className="text-sm font-semibold text-gray-900 cursor-pointer">
                Category Status
              </label>
              <span className="text-xs text-gray-500">
                {formData.isActive ? "Public: Visible to all customers" : "Hidden: Only visible to admins"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Icon/Image URL
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://example.com/icon.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{isEdit ? "Update Category" : "Create Category"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Delete Confirmation Modal Component
// ==========================================

function DeleteCategoryModal({
  category,
  categories,
  onClose,
  onConfirm,
  submitting,
}: {
  category: Category;
  categories: Category[];
  onClose: () => void;
  onConfirm: (reassignToCategoryId: string | null) => void;
  submitting: boolean;
}) {
  const [reassignToCategoryId, setReassignToCategoryId] = useState("");

  const hasProducts = category.productCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
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
                Delete Category
              </h3>
              <p className="text-sm text-gray-500">{category.name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {hasProducts ? (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>Warning:</strong> This category has{" "}
                  <strong>{category.productCount} product(s)</strong>. You must
                  reassign them to another category before deleting.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reassign products to: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reassignToCategoryId}
                  onChange={(e) => setReassignToCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.productCount} products)
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-700">
              Are you sure you want to delete this category? This action cannot
              be undone.
              {category.childCount > 0 && (
                <span className="block mt-2 text-amber-700">
                  <strong>Note:</strong> This category has{" "}
                  {category.childCount} subcategory(ies) which will become
                  top-level categories.
                </span>
              )}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reassignToCategoryId || null)}
            disabled={submitting || (hasProducts && !reassignToCategoryId)}
            className="flex-1 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Category
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}