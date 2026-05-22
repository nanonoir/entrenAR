"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WishlistProductId } from "@/types/account";

type WishlistState = {
  productIds: WishlistProductId[];
  addProduct: (productId: WishlistProductId) => void;
  removeProduct: (productId: WishlistProductId) => void;
  toggleProduct: (productId: WishlistProductId) => void;
  hasProduct: (productId: WishlistProductId) => boolean;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      addProduct: (productId) =>
        set((state) => {
          if (state.productIds.includes(productId)) {
            return state;
          }

          return { productIds: [...state.productIds, productId] };
        }),
      removeProduct: (productId) =>
        set((state) => ({
          productIds: state.productIds.filter((item) => item !== productId),
        })),
      toggleProduct: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((item) => item !== productId)
            : [...state.productIds, productId],
        })),
      hasProduct: (productId) => get().productIds.includes(productId),
    }),
    {
      name: "entrenar-wishlist-preview",
      skipHydration: true,
    },
  ),
);
