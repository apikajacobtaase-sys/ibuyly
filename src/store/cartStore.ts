 // src/store/cartStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  offerId?: string | null;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  slug?: string;
  stockQuantity: number;
  sellerId: string;
  sellerName: string;
  isSelected: boolean;
}

interface CartState {
  items: CartItem[];
  hasHydrated: boolean; // ✅ Add this
  setHasHydrated: (state: boolean) => void; // ✅ Add this
  addItem: (
  item: Omit<CartItem, "id" | "isSelected">
) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  toggleSelect: (id: string) => Promise<void>;
  toggleSelectAll: () => void;
  clearCart: () => void;
  clearGuestCart: () => void;
  syncFromDB: (items: CartItem[]) => void;
  
  selectedItems: () => CartItem[];
  selectedTotalAmount: () => number;
  selectedTotalItems: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false, // ✅ Initialize as false
      setHasHydrated: (state) => set({ hasHydrated: state }),

      selectedItems: () => get().items.filter((i) => i.isSelected && i.stockQuantity > 0),
      selectedTotalAmount: () => get().selectedItems().reduce((sum, item) => sum + item.price * item.quantity, 0),
      selectedTotalItems: () => get().selectedItems().reduce((sum, item) => sum + item.quantity, 0),
      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
addItem: async (newItem) => {
  const availableStock = newItem.stockQuantity ?? 0;

  if (availableStock < 1) {
    alert("This item is out of stock.");
    return false;
  }

  if (!newItem.variantId || !newItem.offerId || !newItem.sellerId) {
    console.error("Cannot add item: required seller offer data is missing.", {
      variantId: newItem.variantId,
      offerId: newItem.offerId,
      sellerId: newItem.sellerId,
    });

    alert("Product information is incomplete. Please refresh and try again.");
    return false;
  }

  const previousItems = get().items;
  const tempId = crypto.randomUUID();

  const existingItem = previousItems.find(
    (item) =>
      item.productId === newItem.productId &&
      item.variantId === newItem.variantId &&
      item.offerId === newItem.offerId
  );

  const requestedQuantity = Math.max(1, newItem.quantity || 1);

  const nextQuantity = Math.min(
    (existingItem?.quantity ?? 0) + requestedQuantity,
    availableStock
  );

  if (existingItem && nextQuantity <= existingItem.quantity) {
    alert(`Sorry, only ${availableStock} items are available.`);
    return false;
  }

  // Save the previous state so a rejected request can be rolled back.
  const optimisticItems = existingItem
    ? previousItems.map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              quantity: nextQuantity,
              stockQuantity: availableStock,
              isSelected: true,
            }
          : item
      )
    : [
        ...previousItems,
        {
          ...newItem,
          id: tempId,
          quantity: Math.min(requestedQuantity, availableStock),
          stockQuantity: availableStock,
          isSelected: true,
        },
      ];

  // Optimistically update the UI.
  set({ items: optimisticItems });

  try {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: newItem.productId,
        variantId: newItem.variantId,
        offerId: newItem.offerId,
        quantity: Math.min(requestedQuantity, availableStock),
      }),
    });

    const contentType = res.headers.get("content-type");

    const data = contentType?.includes("application/json")
      ? await res.json()
      : null;

    if (!res.ok) {
      console.error("Cart API rejected the item:", {
        status: res.status,
        data,
      });

      // Roll back only if this operation's optimistic state
      // is still present, avoiding overwriting a later cart change.
      set((state) => {
        const currentItems = state.items;

        if (existingItem) {
          const currentItem = currentItems.find(
            (item) => item.id === existingItem.id
          );

          if (
            currentItem &&
            currentItem.quantity === nextQuantity &&
            currentItem.stockQuantity === availableStock
          ) {
            return { items: previousItems };
          }

          return state;
        }

        const stillPresent = currentItems.some(
          (item) => item.id === tempId
        );

        return stillPresent
          ? {
              items: currentItems.filter(
                (item) => item.id !== tempId
              ),
            }
          : state;
      });

      return false;
    }

    const realId = data?.item?.id ?? data?.cartItem?.id ?? data?.id;

    if (realId && !existingItem) {
      set((state) => ({
        items: state.items.map((item) =>
          item.id === tempId
            ? { ...item, id: realId }
            : item
        ),
      }));
    }

    return true;
  } catch (error) {
    console.error("Failed to sync cart with the server:", error);

    // A network failure does not confirm that the server rejected
    // the request. Roll back the optimistic change and report failure.
    set((state) => {
      const currentItems = state.items;

      if (existingItem) {
        const currentItem = currentItems.find(
          (item) => item.id === existingItem.id
        );

        if (
          currentItem &&
          currentItem.quantity === nextQuantity &&
          currentItem.stockQuantity === availableStock
        ) {
          return { items: previousItems };
        }

        return state;
      }

      const stillPresent = currentItems.some(
        (item) => item.id === tempId
      );

      return stillPresent
        ? {
            items: currentItems.filter(
              (item) => item.id !== tempId
            ),
          }
        : state;
    });

    return false;
  }
},
      removeItem: async (id) => {
        const item = get().items.find((i) => i.id === id);
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));

        if (item) {
          try {
            await fetch("/api/cart", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cartItemId: id }),
            });
          } catch (error) {
            console.error("Failed to sync cart remove to DB:", error);
          }
        }
      },

      updateQuantity: async (id, quantity) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;

        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const maxStock = item.stockQuantity ?? 999;
        const cappedQuantity = Math.min(quantity, maxStock);

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity: cappedQuantity } : i
          ),
        }));

        try {
          await fetch("/api/cart", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cartItemId: id, 
              quantity: cappedQuantity 
            }),
          });
        } catch (error) {
          console.error("Failed to sync cart update to DB:", error);
        }
      },

      toggleSelect: async (id) => {
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;

        const newIsSelected = !currentItem.isSelected;

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isSelected: newIsSelected } : i
          ),
        }));

        try {
          await fetch("/api/cart", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cartItemId: id, 
              isSelected: newIsSelected 
            }),
          });
        } catch (error) {
          console.error("Failed to sync selection to DB:", error);
        }
      },

      toggleSelectAll: () => {
        const state = get();
        const allSelected = state.items.every((i) => i.isSelected && i.stockQuantity > 0);
        const newSelectionState = !allSelected;
        
        set((state) => ({
          items: state.items.map((i) => 
            i.stockQuantity > 0 ? { ...i, isSelected: newSelectionState } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
      syncFromDB: (items) => set({ items }),
      clearGuestCart: () => {
        set({ items: [] });
        if (typeof window !== "undefined") {
          localStorage.removeItem("ibuy-cart-storage");
        }
      },
    }),
    {
      name: "ibuy-cart-storage",
      // ✅ Add onRehydrateStorage to track when hydration is complete
      onRehydrateStorage: (state) => {
        return () => {
          state.setHasHydrated(true);
        };
      },
    }
  )
);