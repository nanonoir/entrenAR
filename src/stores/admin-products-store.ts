"use client";

import { create } from "zustand";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";

type ProductPriceInput = {
  salePrice: number;
  promotionalPrice?: number;
};

type AdminProductsState = {
  products: AdminProduct[];
  selectedProductIds: string[];
  isInitializing: boolean;
  error: string | null;
  initializeProducts: (products: AdminProduct[]) => void;
  toggleProductSelection: (id: string) => void;
  toggleAllProducts: (ids: string[]) => void;
  clearProductSelection: () => void;
  updateProductPrice: (id: string, prices: ProductPriceInput) => Promise<void>;
};

export const useAdminProductsStore = create<AdminProductsState>()((set, get) => ({
  products: [],
  selectedProductIds: [],
  isInitializing: false,
  error: null,

  initializeProducts: (products) => {
    set((state) => {
      if (state.products.length > 0) return state;
      return { products };
    });
  },

  toggleProductSelection: (id) => {
    set((state) => ({
      selectedProductIds: state.selectedProductIds.includes(id)
        ? state.selectedProductIds.filter((productId) => productId !== id)
        : [...state.selectedProductIds, id],
    }));
  },

  toggleAllProducts: (ids) => {
    set((state) => {
      const allSelected = ids.length > 0 && ids.every((id) => state.selectedProductIds.includes(id));
      if (allSelected) {
        return { selectedProductIds: state.selectedProductIds.filter((id) => !ids.includes(id)) };
      }
      return { selectedProductIds: Array.from(new Set([...state.selectedProductIds, ...ids])) };
    });
  },

  clearProductSelection: () => set({ selectedProductIds: [] }),

  updateProductPrice: async (id, prices) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    set((state) => ({
      products: state.products.map((product) => (product.id === id ? { ...product, ...prices, updatedAt: new Date().toISOString() } : product)),
    }));
    get().clearProductSelection();
  },
}));
