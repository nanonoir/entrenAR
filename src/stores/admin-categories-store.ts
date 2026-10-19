"use client";

import { create } from "zustand";
import {
  ADMIN_CATEGORIES_ERROR_CODE,
  AdminCategoriesApiError,
  describeCategoryError,
  getAdminCategoriesRepository,
  type AdminCategoriesRepository,
  type AdminCategoryInput,
  type AdminCategoryUpdateInput,
} from "@/lib/api/admin/categories";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";

export const CATEGORY_ACTION = { CREATE: "create", DELETE: "delete", UPDATE: "update", VISIBILITY: "visibility" } as const;
type CategoryAction = (typeof CATEGORY_ACTION)[keyof typeof CATEGORY_ACTION];

export type PendingCategoryAction = { id?: string; type: CategoryAction };

/** Error with admin-facing wording; `code` keeps the backend/transport reason. */
export class AdminCategoryActionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AdminCategoryActionError";
  }
}

type AdminCategoriesState = {
  categories: AdminProductCategory[];
  error: string | null;
  hasLoaded: boolean;
  lastSettledAt: number;
  pendingAction: PendingCategoryAction | null;
  syncError: string | null;
  clearError: () => void;
  initializeCategories: (categories: AdminProductCategory[], fetchedAt?: number) => void;
  createCategory: (data: AdminCategoryInput) => Promise<AdminProductCategory>;
  updateCategory: (id: string, data: AdminCategoryUpdateInput) => Promise<AdminProductCategory>;
  toggleCategoryVisibility: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reset: () => void;
};

const initialState = (): Pick<AdminCategoriesState, "categories" | "error" | "hasLoaded" | "lastSettledAt" | "pendingAction" | "syncError"> =>
  ({ categories: [], error: null, hasLoaded: false, lastSettledAt: 0, pendingAction: null, syncError: null });

/**
 * Non-optimistic: a mutation resolves only after the server confirmed it and the canonical
 * tree was reloaded (the backend owns slug, cycle, reference and visibility-cascade rules).
 */
export function createAdminCategoriesStore({ repository }: { repository: AdminCategoriesRepository }) {
  return create<AdminCategoriesState>()((set, get) => {
    async function mutate<T>(action: PendingCategoryAction, run: () => Promise<T>): Promise<T> {
      if (get().pendingAction) {
        throw fail(new AdminCategoriesApiError({ code: ADMIN_CATEGORIES_ERROR_CODE.IN_PROGRESS, message: "A category action is already running.", status: 409 }));
      }
      set({ error: null, pendingAction: action });
      let result: T;
      try {
        result = await run();
      } catch (error) {
        const failure = fail(error);
        set({ error: failure.message, pendingAction: null });
        throw failure;
      }
      try {
        set({ categories: await repository.list(), hasLoaded: true, syncError: null });
      } catch {
        set({ syncError: "Se guardó el cambio, pero no se pudo actualizar la lista. Recargá la página." });
      }
      set({ lastSettledAt: Date.now(), pendingAction: null });
      return result;
    }

    return {
      ...initialState(),

      clearError: () => set({ error: null }),

      initializeCategories: (categories, fetchedAt = Date.now()) => {
        const state = get();
        if (state.pendingAction || fetchedAt < state.lastSettledAt) return;
        set({ categories, hasLoaded: true, syncError: null });
      },

      createCategory: (data) => mutate({ type: CATEGORY_ACTION.CREATE }, () => repository.create(data)),

      updateCategory: (id, data) => mutate({ id, type: CATEGORY_ACTION.UPDATE }, () => repository.update(id, data)),

      toggleCategoryVisibility: (id) => {
        const current = get().categories.find((category) => category.id === id);
        const next = current?.visibility === "hidden" ? "visible" : "hidden";
        return mutate({ id, type: CATEGORY_ACTION.VISIBILITY }, () => repository.setVisibility(id, next));
      },

      deleteCategory: (id) => mutate({ id, type: CATEGORY_ACTION.DELETE }, () => repository.delete(id)),

      reset: () => set(initialState()),
    };
  });
}

function fail(error: unknown): AdminCategoryActionError {
  if (error instanceof AdminCategoryActionError) return error;
  return new AdminCategoryActionError(describeCategoryError(error), error instanceof AdminCategoriesApiError ? error.code : "ADMIN_CATEGORIES_ERROR");
}

export const useAdminCategoriesStore = createAdminCategoriesStore({ repository: getAdminCategoriesRepository() });
