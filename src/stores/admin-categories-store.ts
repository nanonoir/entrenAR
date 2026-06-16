"use client";

import { create } from "zustand";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { CategoryFormValues } from "@/schemas/admin/product-schemas";

type CreateCategoryInput = CategoryFormValues;

type AdminCategoriesState = {
  categories: AdminProductCategory[];
  initializeCategories: (categories: AdminProductCategory[]) => void;
  createCategory: (data: CreateCategoryInput) => Promise<AdminProductCategory>;
  updateCategory: (id: string, data: CategoryFormValues) => Promise<AdminProductCategory>;
  toggleCategoryVisibility: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueSlug(base: string, categories: AdminProductCategory[], ignoreId?: string) {
  const root = slugify(base);
  let slug = root;
  let index = 2;
  while (categories.some((category) => category.id !== ignoreId && category.slug === slug)) {
    slug = `${root}-${index}`;
    index += 1;
  }
  return slug;
}

export const useAdminCategoriesStore = create<AdminCategoriesState>()((set, get) => ({
  categories: [],

  initializeCategories: (categories) => {
    set((state) => (state.categories.length > 0 ? state : { categories }));
  },

  createCategory: async (data) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const category: AdminProductCategory = {
      id: `cat-${Date.now()}`,
      ...data,
      slug: uniqueSlug(data.slug || data.name, get().categories),
    };
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (id, data) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const updated: AdminProductCategory = { id, ...data, slug: uniqueSlug(data.slug || data.name, get().categories, id) };
    set((state) => ({ categories: state.categories.map((category) => (category.id === id ? updated : category)) }));
    return updated;
  },

  toggleCategoryVisibility: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    set((state) => {
      const current = state.categories.find((category) => category.id === id);
      const nextVisibility = current?.visibility === "hidden" ? "visible" : "hidden";
      const affectedIds = new Set([id]);
      if (nextVisibility === "hidden") {
        let changed = true;
        while (changed) {
          changed = false;
          state.categories.forEach((category) => {
            if (category.parentId && affectedIds.has(category.parentId) && !affectedIds.has(category.id)) {
              affectedIds.add(category.id);
              changed = true;
            }
          });
        }
      }
      return { categories: state.categories.map((category) => (affectedIds.has(category.id) ? { ...category, visibility: nextVisibility } : category)) };
    });
  },

  deleteCategory: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    set((state) => {
      const deletedIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        state.categories.forEach((category) => {
          if (category.parentId && deletedIds.has(category.parentId) && !deletedIds.has(category.id)) {
            deletedIds.add(category.id);
            changed = true;
          }
        });
      }
      return { categories: state.categories.filter((category) => !deletedIds.has(category.id)) };
    });
  },
}));
