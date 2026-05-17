"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getPreviewCartItems } from "@/lib/data/cart-preview";
import type { CartPreviewItem } from "@/types/cart";

type CartState = {
  items: CartPreviewItem[];
  addItem: (item: CartPreviewItem) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  clearCart: () => void;
};

function sameCartItem(item: CartPreviewItem, productId: string, variantId: string) {
  return item.productId === productId && item.variantId === variantId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: getPreviewCartItems(),
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((cartItem) =>
            sameCartItem(cartItem, item.productId, item.variantId),
          );

          if (!existing) {
            return { items: [...state.items, item] };
          }

          return {
            items: state.items.map((cartItem) =>
              sameCartItem(cartItem, item.productId, item.variantId)
                ? {
                    ...cartItem,
                    quantity: Math.min(cartItem.stock, cartItem.quantity + item.quantity),
                  }
                : cartItem,
            ),
          };
        }),
      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter((item) => !sameCartItem(item, productId, variantId)),
        })),
      updateQuantity: (productId, variantId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            sameCartItem(item, productId, variantId)
              ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) }
              : item,
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "entrenar-cart-preview",
      skipHydration: true,
    },
  ),
);
