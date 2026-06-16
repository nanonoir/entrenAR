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
  updateProduct: (id: string, data: ProductCreateValues & { categoryName: string }) => Promise<AdminProduct>;
  duplicateProduct: (id: string) => Promise<AdminProduct | undefined>;
  deleteProduct: (id: string) => Promise<void>;
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

function buildProductFromForm(data: ProductCreateValues & { categoryName: string }, overrides: Partial<AdminProduct> = {}): AdminProduct {
  const now = new Date().toISOString();
  const slug = data.slug ?? slugify(data.name);
  return {
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
    manualOrder: 1,
    visibility: data.visibility,
    salesCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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
    const product = buildProductFromForm(data, { manualOrder: get().products.length + 1 });
    set((state) => ({ products: [product, ...state.products] }));
    return product;
  },

  updateProduct: async (id, data) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const current = get().products.find((product) => product.id === id);
    const updated = buildProductFromForm(data, {
      id,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      manualOrder: current?.manualOrder ?? 1,
      salesCount: current?.salesCount ?? 0,
      updatedAt: new Date().toISOString(),
    });
    set((state) => ({
      products: state.products.some((product) => product.id === id)
        ? state.products.map((product) => (product.id === id ? updated : product))
        : [updated, ...state.products],
    }));
    return updated;
  },

  duplicateProduct: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const current = get().products.find((product) => product.id === id);
    if (!current) return undefined;
    const now = new Date().toISOString();
    const slug = `${current.slug}-copia-${Date.now()}`;
    const duplicate: AdminProduct = {
      ...current,
      id: `prod-${Date.now()}`,
      slug,
      publicSlug: slug,
      sku: `PEND-${Date.now()}`,
      name: `${current.name} copia`,
      salesCount: 0,
      manualOrder: get().products.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ products: [duplicate, ...state.products] }));
    return duplicate;
  },

  deleteProduct: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    set((state) => ({ products: state.products.filter((product) => product.id !== id) }));
  },
}));
