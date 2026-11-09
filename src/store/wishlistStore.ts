import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  slug: string;
  sellerName: string;
  variantId?: string;
  offerId?: string;
  sellerId?: string;
  stockQuantity?: number;
  inStock?: boolean;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  fetchWishlist: () => Promise<void>;
  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      isInWishlist: (id) =>
        get().items.some((item) => item.id === id),

      fetchWishlist: async () => {
        const localItems = get().items;
        set({ isLoading: true });

        try {
          // Sync locally saved guest items after authentication.
          const unsyncedItems: WishlistItem[] = [];

          for (const item of localItems) {
            try {
              const response = await fetch("/api/wishlist", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: item.id }),
              });

              if (response.status === 401) {
                return;
              }

              if (!response.ok) {
                unsyncedItems.push(item);
              }
            } catch {
              unsyncedItems.push(item);
            }
          }

          const response = await fetch("/api/wishlist", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });

          if (!response.ok) {
            return;
          }

          const data = await response.json();

          if (Array.isArray(data.items)) {
            const serverItems = data.items as WishlistItem[];
            const serverIds = new Set(serverItems.map((item) => item.id));

            set({
              items: [
                ...serverItems,
                ...unsyncedItems.filter((item) => !serverIds.has(item.id)),
              ],
            });
          }
        } catch (error) {
          console.error("Failed to fetch wishlist:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      addItem: async (item) => {
        if (get().items.some((existing) => existing.id === item.id)) {
          return;
        }

        set((state) => ({
          items: [...state.items, item],
        }));

        try {
          const response = await fetch("/api/wishlist", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: item.id }),
          });

          // Guests keep their wishlist locally.
          if (!response.ok && response.status !== 401) {
            console.error("Failed to save wishlist item:", response.status);
          }
        } catch (error) {
          console.error("Failed to sync wishlist addition:", error);
        }
      },

      removeItem: async (id) => {
        const previousItems = get().items;

        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));

        try {
          const response = await fetch(
            `/api/wishlist?productId=${encodeURIComponent(id)}`,
            {
              method: "DELETE",
              credentials: "same-origin",
            }
          );

          // A guest has no database wishlist to update.
          if (!response.ok && response.status !== 401) {
            set({ items: previousItems });
          }
        } catch (error) {
          console.error("Failed to sync wishlist removal:", error);
          // Keep the local removal; the server can be reconciled later.
        }
      },

      clearWishlist: async () => {
        const previousItems = get().items;

        // Clear immediately for a responsive guest experience.
        set({ items: [] });

        try {
          const response = await fetch("/api/wishlist", {
            method: "DELETE",
            credentials: "same-origin",
          });

          if (!response.ok && response.status !== 401) {
            set({ items: previousItems });
          }
        } catch (error) {
          console.error("Failed to clear wishlist:", error);
          set({ items: previousItems });
        }
      },
    }),
    {
      name: "ibuy-wishlist-storage",
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
