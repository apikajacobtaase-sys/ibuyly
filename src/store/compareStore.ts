// src/store/compareStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompareItem {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  price: number;
}

interface CompareStore {
  items: CompareItem[];
  addItem: (item: CompareItem) => void;
  removeItem: (id: string) => void;
  isInCompare: (id: string) => boolean;
  clearCompare: () => void;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          if (state.items.length >= 4) return state; // Max 4 products
          if (state.items.some((i) => i.id === item.id)) return state;
          return { items: [...state.items, item] };
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      isInCompare: (id) => get().items.some((item) => item.id === id),
      clearCompare: () => set({ items: [] }),
    }),
    {
      name: "ibuy-compare",
    }
  )
);