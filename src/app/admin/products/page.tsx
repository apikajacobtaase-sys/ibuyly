// src/app/admin/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Eye, Archive, CheckCircle, Package } from "lucide-react";
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchProducts();
  }, [statusFilter]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (productId: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to change this product's status to ${newStatus}?`)) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchProducts();
      } else {
        alert("❌ Failed to update product");
      }
    } catch (error) {
      alert("❌ Network error");
    }
  };

  const filteredProducts = search
    ? products.filter((p) =>
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
            <p className="text-xs text-gray-500 truncate">{item.sellerName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      render: (item) => <span className="text-sm text-gray-700">{item.categoryName}</span>,
    },
    {
      key: "price",
      header: "Price",
      render: (item) => <span className="font-semibold text-sm">GH₵ {item.price.toFixed(2)}</span>,
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Product Moderation</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review and moderate all products across the marketplace
        </p>
      </div>

      {/* Filters */}
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
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
          <p className="text-xs text-gray-500">Total Products</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {products.filter((p) => p.status === "ACTIVE").length}
          </p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {products.filter((p) => p.status === "DRAFT").length}
          </p>
          <p className="text-xs text-gray-500">Drafts</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">
            {products.filter((p) => p.status === "ARCHIVED").length}
          </p>
          <p className="text-xs text-gray-500">Archived</p>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
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
  );
}