 // src/app/seller/inventory/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Edit2, AlertTriangle } from "lucide-react";
import { StatusBadge, DataTable, Column } from "@/components/dashboard";

// ðŸ‘‡ Updated interface to match the new SellerOffer-based API response
interface InventoryItem {
  offerId: string;
  variantId: string;
  productTitle: string;
  productSlug: string;
  imageUrl: string | null;
  sku: string;
  sellerSku: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: string;
  status: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stock: "", threshold: "" });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/seller/inventory");
      const data = await res.json();
      if (res.ok) setInventory(data.inventory || []);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.offerId); // ðŸ‘ˆ FIX: Use offerId for tracking edit state
    setEditValues({
      stock: item.stockQuantity.toString(),
      threshold: item.lowStockThreshold.toString()
    });
  };

    const handleSave = async (offerId: string) => {
    try {
      const res = await fetch("/api/seller/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          stockQuantity: editValues.stock,
          lowStockThreshold: editValues.threshold, // ðŸ‘ˆ Ensure this is sent
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEditingId(null);
        fetchInventory(); // Refresh to show updated values
      } else {
        alert(data.error || "Failed to update inventory");
      }
    } catch (error) {
      console.error("Failed to update inventory", error);
      alert("Network error occurred");
    }
  };
  const getStockBadge = (status: string) => {
    if (status === "OUT_OF_STOCK") return <StatusBadge status="OUT_OF_STOCK" />;
    if (status === "LOW_STOCK") return <StatusBadge status="PENDING" />;
    return <StatusBadge status="ACTIVE" />;
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.imageUrl && (
            <img src={item.imageUrl} alt={item.productTitle} className="w-10 h-10 rounded object-cover bg-gray-100 border border-gray-200" />
          )}
          <div>
            <Link href={`/products/${item.productSlug}`} className="font-medium text-teal-600 hover:underline text-sm">
              {item.productTitle}
            </Link>
            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Current Stock",
      render: (item) => (
        editingId === item.offerId ? ( // ðŸ‘ˆ FIX: Check against offerId
          <input
            type="number"
            value={editValues.stock}
            onChange={(e) => setEditValues({ ...editValues, stock: e.target.value })}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        ) : (
          <span className={`font-semibold ${item.stockQuantity === 0 ? "text-red-600" : item.stockQuantity <= item.lowStockThreshold ? "text-orange-600" : "text-gray-900"}`}>
            {item.stockQuantity}
          </span>
        )
      ),
    },
    {
      key: "threshold",
      header: "Low Stock Alert",
      render: (item) => (
        editingId === item.offerId ? ( // ðŸ‘ˆ FIX: Check against offerId
          <input
            type="number"
            value={editValues.threshold}
            onChange={(e) => setEditValues({ ...editValues, threshold: e.target.value })}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        ) : (
          <span className="text-sm text-gray-600">{item.lowStockThreshold} units</span>
        )
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => getStockBadge(item.stockStatus),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item) => (
        editingId === item.offerId ? ( // ðŸ‘ˆ FIX: Check against offerId
          <button
            onClick={() => handleSave(item.offerId)}
            className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 transition"
          >
            Save
          </button>
        ) : (
          <button
            onClick={() => handleEdit(item)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        )
      ),
    },
  ];

  const lowStockCount = inventory.filter((i) => i.stockStatus !== "IN_STOCK").length;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">My Inventory</h2>
          <p className="text-sm text-gray-500 mt-1">Manage stock levels and alerts for your specific offers</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-xs font-medium text-orange-700 sm:px-4 sm:text-sm">
            <AlertTriangle className="w-4 h-4" />
            {lowStockCount} item(s) need restocking
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto"></div>
        </div>
      ) : (
        inventory.length === 0 ? (
          <DataTable
            columns={columns}
            data={inventory}
            keyExtractor={(item) => item.offerId}
            emptyMessage="No inventory items found. Start by adding a product!"
          />
        ) : (
          <>
            {/* Mobile and tablet inventory cards */}
            <div className="space-y-3 lg:hidden">
              {inventory.map((item) => {
                const isEditing = editingId === item.offerId;

                return (
                  <article
                    key={item.offerId}
                    className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productTitle}
                          className="h-16 w-16 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                          No image
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="line-clamp-2 text-sm font-semibold text-teal-700 hover:underline"
                        >
                          {item.productTitle}
                        </Link>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          SKU: {item.sellerSku || item.sku || "N/A"}
                        </p>
                        <div className="mt-2">
                          {getStockBadge(item.stockStatus)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Current Stock
                        </p>

                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.stock}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                stock: e.target.value,
                              })
                            }
                            aria-label={`Stock quantity for ${item.productTitle}`}
                            className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        ) : (
                          <p className={`mt-1 text-xl font-bold ${
                            item.stockQuantity === 0
                              ? "text-red-600"
                              : item.stockQuantity <= item.lowStockThreshold
                                ? "text-orange-600"
                                : "text-gray-900"
                          }`}>
                            {item.stockQuantity}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Low Stock Alert
                        </p>

                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.threshold}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                threshold: e.target.value,
                              })
                            }
                            aria-label={`Low stock threshold for ${item.productTitle}`}
                            className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        ) : (
                          <p className="mt-2 text-base font-semibold text-gray-800">
                            {item.lowStockThreshold} units
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-gray-900">
                        GH {Number(item.price).toFixed(2)}
                      </p>

                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => handleSave(item.offerId)}
                          className="min-h-11 min-w-24 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit Stock
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop inventory table */}
            <div className="hidden lg:block">
              <DataTable
                columns={columns}
                data={inventory}
                keyExtractor={(item) => item.offerId}
                emptyMessage="No inventory items found. Start by adding a product!"
              />
                       </div>
          </>
        )
      )}
    </div>
  );
}
