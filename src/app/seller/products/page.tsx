 // src/app/seller/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Archive, RotateCcw, Package, Trash2, Save, X, Edit2 } from "lucide-react";
import { StatusBadge, DataTable, Column } from "@/components/dashboard";
import { useSellerPermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/Skeleton";

interface Product {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryName: string;
  reviewCount: number;
  createdAt: string;
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const { permissions } = useSellerPermissions();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ State for Inline Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ price: 0, stock: 0 });

  useEffect(() => {
    fetchProducts();
  }, [statusFilter, sort, page]); // Removed totalPages from dependency to avoid loop

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/seller/products?page=${page}&limit=10&search=${search}&status=${statusFilter}&sort=${sort}`);
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to page 1 on search
    fetchProducts();
  };

  // ✅ Handle Status Change (Archive/Reactivate)
  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/seller/products", { // Ensure this points to seller API
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, status: newStatus }),
      });
      if (res.ok) fetchProducts();
    } catch (error) {
      console.error("Failed to update product", error);
    }
  };

  // ✅ Handle Delete
  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/seller/products?id=${productId}`, { method: "DELETE" });
      if (res.ok) fetchProducts();
    } catch (error) {
      alert("Failed to delete product");
    }
  };

  // ✅ Handle Inline Edit Start
  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditValues({ price: product.price, stock: product.stock });
  };

  // ✅ Handle Inline Edit Save
  const saveEdit = async (productId: string) => {
    try {
      const res = await fetch("/api/seller/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, price: editValues.price, stockQuantity: editValues.stock }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchProducts();
      }
    } catch (error) {
      alert("Failed to save changes");
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: "Product",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <Package className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{item.title}</p>
            <p className="text-xs text-gray-500">{item.categoryName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (item) => (
        editingId === item.id ? (
          <input
            type="number"
            value={editValues.price}
            onChange={(e) => setEditValues({ ...editValues, price: parseFloat(e.target.value) })}
            className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-teal-500 outline-none"
          />
        ) : (
          <span className="font-semibold">GH₵ {item.price.toFixed(2)}</span>
        )
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (item) => (
        editingId === item.id ? (
          <input
            type="number"
            value={editValues.stock}
            onChange={(e) => setEditValues({ ...editValues, stock: parseInt(e.target.value) })}
            className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-teal-500 outline-none"
          />
        ) : (
          <span className={item.stock <= 5 ? "text-red-600 font-semibold" : "text-gray-900"}>
            {item.stock}
          </span>
        )
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item) => {
        if (!permissions?.canManageProducts) return null;
        
        return (
          <div className="flex items-center justify-end gap-2">
            {editingId === item.id ? (
              <>
                <button onClick={() => saveEdit(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <button onClick={() => startEditing(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit Price/Stock"><Edit2 className="w-4 h-4" /></button>
                <Link href={`/products/${item.slug}`} className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded" title="View"><Eye className="w-4 h-4" /></Link>
                
                {item.status === "ACTIVE" ? (
                  <button onClick={() => handleStatusChange(item.id, "ARCHIVED")} className="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded" title="Archive"><Archive className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => handleStatusChange(item.id, "ACTIVE")} className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded" title="Reactivate"><RotateCcw className="w-4 h-4" /></button>
                )}
                
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Products</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your inventory, prices, and availability.
          </p>
        </div>
        {permissions?.canManageProducts && (
          <Link
            href="/seller/products/new"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition self-start shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
          >
            Filter
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(item) => item.id}
          emptyMessage="No products found. Create your first product!"
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl mt-4 shadow-sm">
          <p className="text-sm text-gray-500">
            Page <span className="font-medium text-gray-900">{page}</span> of <span className="font-medium text-gray-900">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}