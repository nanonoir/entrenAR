"use client";

import { create } from "zustand";
import type { AdminProduct, AdminProductStock } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateValues } from "@/schemas/admin/product-schemas";

type ProductPriceInput = {
  salePrice: number;
  promotionalPrice?: number;
};

type AdminProductsState = {
  products: AdminProduct[];
  stockHistory: StockHistoryEntry[];
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
  updateInventoryStock: (input: UpdateInventoryStockInput) => Promise<void>;
};

export type StockHistoryEntry = {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  change: string;
  resultingStock: string;
  origin: string;
  actor: string;
  reason?: string;
  type: "stock-edit" | "new-product";
  createdAt: string;
};

type UpdateInventoryStockInput = {
  productId: string;
  variantId?: string;
  stock: AdminProductStock | number | "infinite";
  reason?: string;
};

function formatStockValue(stock: AdminProductStock | number | "infinite") {
  if (stock === "infinite") return "∞";
  if (typeof stock === "number") return String(stock);
  return stock.type === "infinite" ? "∞" : String(stock.quantity);
}

function createStableId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

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
    id: createStableId("prod"),
    slug,
    publicSlug: slug,
    name: data.name,
    sku: data.sku ?? createStableId("PEND"),
    description: data.description,
    imageUrl: data.imageUrl,
    categoryId: data.categoryIds[0] ?? "",
    categoryIds: data.categoryIds,
    categoryName: data.categoryName,
    stock: data.stockMode === "infinite" ? { type: "infinite" } : { type: "limited", quantity: data.stockQuantity ?? 0 },
    salePrice: data.salePrice,
    promotionalPrice: data.promotionalPrice,
    tags: data.tags ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    brand: data.brand,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    highlightSections: data.highlightSections,
    variantProperties: data.variantProperties,
    variantCombinations: data.variantCombinations,
    shippingRequired: true,
    missingLogistics: !(data.weightGrams && data.heightCm && data.widthCm && data.lengthCm),
    weightGrams: data.weightGrams,
    heightCm: data.heightCm,
    widthCm: data.widthCm,
    lengthCm: data.lengthCm,
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
  stockHistory: [],
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
    const slug = `${current.slug}-copia-${createStableId("copy")}`;
    const duplicate: AdminProduct = {
      ...current,
      id: createStableId("prod"),
      slug,
      publicSlug: slug,
      sku: createStableId("PEND"),
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
    set((state) => ({
      products: state.products.filter((product) => product.id !== id),
      selectedProductIds: state.selectedProductIds.filter((productId) => productId !== id),
    }));
  },

  updateInventoryStock: async ({ productId, reason, stock, variantId }) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    set((state) => {
      const product = state.products.find((item) => item.id === productId);
      if (!product) return state;
      const variant = product.variantCombinations.find((item) => item.id === variantId);
      const nextProducts = state.products.map((item) => {
        if (item.id !== productId) return item;
        if (variantId) {
          const variantStock = typeof stock === "object" ? stock.type === "infinite" ? "infinite" : stock.quantity : stock;
          return {
            ...item,
            variantCombinations: item.variantCombinations.map((combo) => (combo.id === variantId ? { ...combo, stock: variantStock } : combo)),
            updatedAt: new Date().toISOString(),
          };
        }
        const nextStock: AdminProductStock = typeof stock === "object" ? stock : stock === "infinite" ? { type: "infinite" } : { type: "limited", quantity: stock };
        return { ...item, stock: nextStock, updatedAt: new Date().toISOString() };
      });
      const entry: StockHistoryEntry = {
        id: createStableId("hist"),
        productId,
        variantId,
        productName: product.name,
        variantName: variant?.name,
        change: `Stock actualizado a ${formatStockValue(stock)}`,
        resultingStock: formatStockValue(stock),
        origin: "CRM Productos",
        actor: "Admin demo",
        reason,
        type: "stock-edit",
        createdAt: new Date().toISOString(),
      };
      return { products: nextProducts, stockHistory: [entry, ...state.stockHistory] };
    });
  },
}));
