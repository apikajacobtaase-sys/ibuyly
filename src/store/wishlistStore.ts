 // src/store/wishlistStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  id: string; // productId
  title: string;
  price: number;
  imageUrl: string | null;
  slug: string;
  sellerName: string;
}

interface WishlistState {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      isInWishlist: (id) => get().items.some((i) => i.id === id),

      addItem: async (item) => {
        // 1. Optimistic Update
        set((state) => {
          if (state.items.some((i) => i.id === item.id)) return state;
          return { items: [...state.items, item] };
        });

        // 2. Sync to DB
        try {
          await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: item.id }),
          });
        } catch (error) {
          console.error("Failed to sync wishlist add:", error);
        }
      },

      removeItem: async (id) => {
        // 1. Optimistic Update
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));

        // 2. Sync to DB
        try {
          await fetch(`/api/wishlist?productId=${id}`, {
            method: "DELETE",
          });
        } catch (error) {
          console.error("Failed to sync wishlist remove:", error);
        }
      },

      clearWishlist: () => set({ items: [] }),
    }),
    { name: "ibuy-wishlist-storage" }
  )
);