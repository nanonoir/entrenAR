"use client";

import { create } from "zustand";
import type { AdminProduct } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateValues } from "@/schemas/admin/product-schemas";

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
  createProduct: (data: ProductCreateValues & { categoryName: string }) => Promise<AdminProduct>;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

  createProduct: async (data) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const now = new Date().toISOString();
    const slug = data.slug ?? slugify(data.name);
    const product: AdminProduct = {
      id: `prod-${Date.now()}`,
      slug,
      publicSlug: slug,
      name: data.name,
      sku: data.sku,
      imageUrl: data.imageUrl,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      stock: data.stockMode === "infinite" ? { type: "infinite" } : { type: "limited", quantity: data.stockQuantity ?? 0 },
      salePrice: data.salePrice,
      promotionalPrice: data.promotionalPrice,
      tags: data.tags ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      shippingRequired: data.shippingRequired,
      missingLogistics: data.missingLogistics,
      manualOrder: get().products.length + 1,
      visibility: data.visibility,
      salesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ products: [product, ...state.products] }));
    return product;
  },
}));
