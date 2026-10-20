 // src/app/seller/inventory/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Edit2, AlertTriangle } from "lucide-react";
import { StatusBadge, DataTable, Column } from "@/components/dashboard";

// 👇 Updated interface to match the new SellerOffer-based API response
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
    setEditingId(item.offerId); // 👈 FIX: Use offerId for tracking edit state
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
          lowStockThreshold: editValues.threshold, // 👈 Ensure this is sent
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
        editingId === item.offerId ? ( // 👈 FIX: Check against offerId
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
        editingId === item.offerId ? ( // 👈 FIX: Check against offerId
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
        editingId === item.offerId ? ( // 👈 FIX: Check against offerId
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Inventory</h2>
          <p className="text-sm text-gray-500 mt-1">Manage stock levels and alerts for your specific offers</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium border border-orange-200">
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
        <DataTable
          columns={columns}
          data={inventory}
          keyExtractor={(item) => item.offerId} // 👈 FIX: Use offerId as the unique key
          emptyMessage="No inventory items found. Start by adding a product!"
        />
      )}
    </div>
  );
}