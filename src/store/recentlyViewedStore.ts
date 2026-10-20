// src/store/recentlyViewedStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ViewedProduct {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  price: number;
  viewedAt: number;
}

interface RecentlyViewedStore {
  items: ViewedProduct[];
  addView: (product: Omit<ViewedProduct, "viewedAt">) => void;
  clearAll: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      items: [],
      addView: (product) =>
        set((state) => {
          // Remove if already exists, then add to front
          const filtered = state.items.filter((i) => i.id !== product.id);
          const newItem = { ...product, viewedAt: Date.now() };
          const newItems = [newItem, ...filtered].slice(0, 10); // Keep last 10
          return { items: newItems };
        }),
      clearAll: () => set({ items: [] }),
    }),
    { name: "ibuy-recently-viewed" }
  )
);