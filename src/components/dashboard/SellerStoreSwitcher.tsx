"use client";

import { useEffect, useState } from "react";
import { Store, ChevronDown, Loader2 } from "lucide-react";

interface SellerStore {
  id: string;
  businessName: string;
  businessType: string;
  logoUrl: string | null;
  accessRole: string;
  isOwner: boolean;
  permissions: {
    canManageProducts: boolean;
    canManageInventory: boolean;
    canManageOrders: boolean;
    canViewFinances: boolean;
    canManageReviews: boolean;
    canManageSettings: boolean;
  };
}

interface StoresResponse {
  stores: SellerStore[];
  selectedStoreId: string | null;
}

export default function SellerStoreSwitcher() {
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      try {
        const response = await fetch("/api/seller/stores", {
          cache: "no-store",
        });

        const data = (await response.json()) as StoresResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load seller stores.");
        }

        if (cancelled) return;

        setStores(data.stores || []);
        setSelectedStoreId(data.selectedStoreId || "");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load stores."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStores();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStoreChange(sellerId: string) {
    if (!sellerId || sellerId === selectedStoreId) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/seller/stores/selection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sellerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not switch stores.");
      }

      setSelectedStoreId(sellerId);
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not switch stores."
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading seller stores...
      </div>
    );
  }

  if (stores.length === 0) return null;

  const selectedStore = stores.find(
    (store) => store.id === selectedStoreId
  );

  return (
    <section
      aria-label="Active seller store"
      aria-busy={saving}
      className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 text-teal-700">
          {selectedStore?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedStore.logoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Store className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500">
            ACTIVE SELLER STORE
          </p>

          {selectedStore ? (
            <>
              <p className="truncate text-sm font-semibold text-gray-900">
                {selectedStore.businessName}
              </p>
              <p className="text-xs text-gray-500">
                {selectedStore.accessRole.replace("_", " ")}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-amber-700">
              Choose a store to continue
            </p>
          )}
        </div>

        {stores.length === 1 && !selectedStore && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handleStoreChange(stores[0].id)}
            className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? "Selecting..." : "Select this store"}
          </button>
        )}

        {stores.length > 1 && (
          <div className="relative shrink-0">
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
            ) : (
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            )}

            <select
              aria-label="Select seller store"
              value={selectedStoreId}
              disabled={saving}
              onChange={(event) => handleStoreChange(event.target.value)}
              className="max-w-36 appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-xs font-medium text-gray-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
            >
              <option value="" disabled>
                Select store
              </option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.businessName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}