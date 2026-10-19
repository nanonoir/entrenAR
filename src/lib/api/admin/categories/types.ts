import type { CategoryFormValues } from "@/schemas/admin/product-schemas";
import type { AdminProductCategory } from "@/types/admin-product";

export type AdminCategoryInput = CategoryFormValues;
export type AdminCategoryVisibility = AdminProductCategory["visibility"];

const CLEARABLE_FIELDS = ["description", "googleShoppingCategory", "imageUrl", "parentId", "seoDescription", "seoTitle"] as const;
type ClearableField = (typeof CLEARABLE_FIELDS)[number];

/** PUT body: an omitted field is preserved by the server; an explicit `null` clears it (`parentId: null` moves to the root). */
export type AdminCategoryUpdateInput = Omit<AdminCategoryInput, ClearableField | "slug"> & { slug?: string } & { [K in ClearableField]?: string | null };

/** Edit form intent: a blank field means "clear it", so it is sent as an explicit `null`. `slug` stays omitted when blank. */
export function toCategoryUpdateInput(values: AdminCategoryInput): AdminCategoryUpdateInput {
  const update: AdminCategoryUpdateInput = { ...values };
  for (const field of CLEARABLE_FIELDS) update[field] = values[field] ?? null;
  return update;
}

export const ADMIN_CATEGORIES_ERROR_CODE = {
  IN_PROGRESS: "CATEGORY_MUTATION_IN_PROGRESS",
  INVALID_RESPONSE: "ADMIN_CATEGORIES_INVALID_RESPONSE",
} as const;

export class AdminCategoriesApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ code, message, status }: { code: string; message: string; status: number }) {
    super(message);
    this.code = code;
    this.name = "AdminCategoriesApiError";
    this.status = status;
  }
}

/** Spanish, admin-facing wording for the failures the category screens can hit. */
export function describeCategoryError(error: unknown): string {
  const code = error instanceof AdminCategoriesApiError ? error.code : undefined;
  const status = error instanceof AdminCategoriesApiError ? error.status : undefined;
  if (code === "CATEGORY_IN_USE") return "No se puede eliminar: hay productos asociados a esta categoría o a sus subcategorías.";
  if (code === "CATEGORY_CYCLE") return "Una categoría no puede depender de sí misma ni de sus subcategorías.";
  if (code === "SLUG_CONFLICT") return "Ese slug ya está en uso por otra categoría.";
  if (code === "NOT_FOUND" || status === 404) return "La categoría ya no existe. Actualizá la lista e intentá nuevamente.";
  if (code === ADMIN_CATEGORIES_ERROR_CODE.IN_PROGRESS) return "Hay otra acción sobre categorías en curso. Esperá a que termine.";
  if (status === 401 || status === 403 || code === "ADMIN_SESSION_ENDED") return "Tu sesión de administrador expiró o no tiene permisos. Iniciá sesión nuevamente.";
  if (status === 400 || code === "VALIDATION_ERROR") return "El servidor rechazó los datos de la categoría. Revisalos e intentá nuevamente.";
  if (status === 503 || code === "ADMIN_API_UNAVAILABLE") return "No se pudo conectar con el servidor. Intentá nuevamente.";
  return "No se pudo completar la acción. Intentá nuevamente.";
}
