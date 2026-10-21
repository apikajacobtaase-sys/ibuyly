
// src/store/wishlistStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  id: string; // Product ID
  title: string;
  price: number;
  imageUrl: string | null;
  slug: string;
  sellerName: string;

  // Optional IDs for integrations such as Move to Cart.
  // These must be real database IDs, never placeholders.
  variantId?: string;
  offerId?: string;
  sellerId?: string;
  stockQuantity?: number;
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

      // Load saved products from the database.
      fetchWishlist: async () => {
        set({ isLoading: true });

        try {
          const response = await fetch("/api/wishlist", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });

          if (!response.ok) {
            console.error(
              "Failed to load wishlist:",
              response.status,
              await response.text()
            );
            return;
          }

          const data = await response.json();

          if (Array.isArray(data.items)) {
            set({ items: data.items });
          }
        } catch (error) {
          console.error("Failed to fetch wishlist:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Add locally first, then persist to the database.
      addItem: async (item) => {
        const alreadyExists = get().items.some(
          (existing) => existing.id === item.id
        );

        if (alreadyExists) return;

        set((state) => ({
          items: [...state.items, item],
        }));

        try {
          const response = await fetch("/api/wishlist", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: item.id,
            }),
          });

          if (!response.ok) {
            console.error(
              "Failed to save wishlist item:",
              response.status,
              await response.text()
            );
          }
        } catch (error) {
          console.error("Failed to sync wishlist addition:", error);
        }
      },

      // Remove locally and from the database.
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

          if (!response.ok) {
            console.error(
              "Failed to remove wishlist item:",
              response.status,
              await response.text()
            );

            // Restore local data if the server rejects the removal.
            set({ items: previousItems });
          }
        } catch (error) {
          console.error("Failed to sync wishlist removal:", error);
          set({ items: previousItems });
        }
      },

      // Clear the database first; clear local state only on success.
      clearWishlist: async () => {
        const previousItems = get().items;

        try {
          const response = await fetch("/api/wishlist", {
            method: "DELETE",
            credentials: "same-origin",
          });

          if (!response.ok) {
            console.error(
              "Failed to clear wishlist:",
              response.status,
              await response.text()
            );
            return;
          }

          set({ items: [] });
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
