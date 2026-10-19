import type { AdminProductCategory } from "@/types/admin-product";
import type { AdminCategoryInput, AdminCategoryUpdateInput, AdminCategoryVisibility } from "./types";

/**
 * Admin category persistence. Every method resolves only with server-confirmed data
 * and rejects with `AdminCategoriesApiError`. `list` returns the flattened canonical tree.
 */
export interface AdminCategoriesRepository {
  readonly source: "api" | "mock";
  list(): Promise<AdminProductCategory[]>;
  create(input: AdminCategoryInput): Promise<AdminProductCategory>;
  update(id: string, input: AdminCategoryUpdateInput): Promise<AdminProductCategory>;
  setVisibility(id: string, visibility: AdminCategoryVisibility): Promise<void>;
  delete(id: string): Promise<void>;
}
