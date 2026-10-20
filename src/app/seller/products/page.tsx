// src/app/seller/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Archive, RotateCcw, Package } from "lucide-react";
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
  useEffect(() => {
    fetchProducts();
  }, [statusFilter, sort, page, totalPages]);

   const fetchProducts = async () => {
     setIsLoading(true);
     try {
       const res = await fetch(`/api/seller/products?page=${page}&limit=10`);
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
    fetchProducts();
  };

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, status: newStatus }),
      });
      if (res.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error("Failed to update product", error);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: "Product",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover" />
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
      render: (item) => <span className="font-semibold">GH₵ {item.price.toFixed(2)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      render: (item) => (
        <span className={item.stock <= 5 ? "text-red-600 font-semibold" : "text-gray-900"}>
          {item.stock}
        </span>
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
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/products/${item.slug}`}
              className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded transition"
              title="View"
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
            ) : item.status === "ARCHIVED" ? (
              <button
                onClick={() => handleStatusChange(item.id, "ACTIVE")}
                className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
                title="Reactivate"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            ) : null}
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
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
               {permissions?.canManageProducts && (
          <Link
            href="/seller/products/new"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition self-start"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
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
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
          >
            Search
          </button>
        </form>
      </div>

       {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {/* Skeleton Header */}
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          
          {/* Skeleton Table Rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-8 w-8 rounded" />
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

      {/* Pagination Controls */}
           {totalPages > 1 && (
             <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl mt-4">
               <p className="text-sm text-gray-500">
                 Page <span className="font-medium text-gray-900">{page}</span> of{" "}
                 <span className="font-medium text-gray-900">{totalPages}</span>
               </p>
               <div className="flex gap-2">
                 <button
                   onClick={() => setPage((p) => Math.max(1, p - 1))}
                   disabled={page === 1}
                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                 >
                   Previous
                 </button>
                 <button
                   onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                   disabled={page === totalPages}
                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                 >
                   Next
                 </button>
               </div>
             </div>
           )}
    </div>
  );
}