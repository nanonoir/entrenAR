import { mockAdminProductCategories, mockAdminProducts } from "@/lib/data/admin/sales-flow/mock-products";
import type { AdminProductCategory } from "@/types/admin-product";
import type { AdminCategoriesRepository } from "./repository";
import { AdminCategoriesApiError, type AdminCategoryInput, type AdminCategoryUpdateInput, type AdminCategoryVisibility } from "./types";

/** Explicit offline implementation; imitates the backend rules but is in-memory only. */
export class MockAdminCategoriesRepository implements AdminCategoriesRepository {
  readonly source = "mock" as const;
  private categories: AdminProductCategory[];
  private nextId = 1;

  constructor(initial: readonly AdminProductCategory[] = mockAdminProductCategories, private readonly referencedCategoryIds: ReadonlySet<string> = defaultReferencedIds()) {
    this.categories = initial.map((category) => ({ ...category }));
  }

  async list(): Promise<AdminProductCategory[]> {
    return this.categories.map((category) => ({ ...category }));
  }

  async create(input: AdminCategoryInput): Promise<AdminProductCategory> {
    if (input.parentId) this.require(input.parentId);
    const category: AdminProductCategory = {
      ...clean(input),
      id: `cat-mock-${this.nextId++}`,
      slug: input.slug ? this.explicitSlug(input.slug) : this.uniqueSlug(input.name),
    };
    this.categories.push(category);
    return { ...category };
  }

  async update(id: string, input: AdminCategoryUpdateInput): Promise<AdminProductCategory> {
    const current = this.require(id);
    if (input.parentId) this.require(input.parentId);
    if (this.createsCycle(id, input.parentId ?? undefined)) throw failure("CATEGORY_CYCLE", 409);
    // Same semantics as the backend: undefined preserves the stored value, null clears it.
    const merged: AdminCategoryInput = {
      description: input.description === undefined ? current.description : input.description ?? undefined,
      googleShoppingCategory: input.googleShoppingCategory === undefined ? current.googleShoppingCategory : input.googleShoppingCategory ?? undefined,
      imageUrl: input.imageUrl === undefined ? current.imageUrl : input.imageUrl ?? undefined,
      name: input.name,
      parentId: input.parentId === undefined ? current.parentId : input.parentId ?? undefined,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription ?? undefined,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle ?? undefined,
      slug: input.slug,
      visibility: input.visibility,
    };
    const updated: AdminProductCategory = {
      ...clean(merged),
      id,
      slug: input.slug ? this.explicitSlug(input.slug, id) : current.slug,
    };
    const hiddenIds = input.visibility === "hidden" ? new Set(this.descendantIds(id)) : new Set<string>();
    this.categories = this.categories.map((category) => {
      if (category.id === id) return updated;
      return hiddenIds.has(category.id) ? { ...category, visibility: "hidden" } : category;
    });
    return { ...updated };
  }

  async setVisibility(id: string, visibility: AdminCategoryVisibility): Promise<void> {
    this.require(id);
    const ids = new Set(visibility === "hidden" ? this.descendantIds(id) : [id]);
    this.categories = this.categories.map((category) => ids.has(category.id) ? { ...category, visibility } : category);
  }

  async delete(id: string): Promise<void> {
    this.require(id);
    const ids = new Set(this.descendantIds(id));
    if ([...ids].some((categoryId) => this.referencedCategoryIds.has(categoryId))) throw failure("CATEGORY_IN_USE", 409);
    this.categories = this.categories.filter((category) => !ids.has(category.id));
  }

  private require(id: string): AdminProductCategory {
    const category = this.categories.find((item) => item.id === id);
    if (!category) throw failure("NOT_FOUND", 404);
    return category;
  }

  private descendantIds(id: string): string[] {
    const ids = [id];
    for (let index = 0; index < ids.length; index += 1) {
      for (const category of this.categories) if (category.parentId === ids[index]) ids.push(category.id);
    }
    return ids;
  }

  private createsCycle(id: string, parentId: string | undefined): boolean {
    const visited = new Set<string>();
    let current = parentId;
    while (current) {
      if (current === id || visited.has(current)) return true;
      visited.add(current);
      current = this.categories.find((category) => category.id === current)?.parentId;
    }
    return false;
  }

  private explicitSlug(value: string, ignoredId?: string): string {
    const slug = slugify(value);
    if (this.categories.some((category) => category.slug === slug && category.id !== ignoredId)) throw failure("SLUG_CONFLICT", 409);
    return slug;
  }

  private uniqueSlug(name: string): string {
    const root = slugify(name);
    let slug = root;
    for (let suffix = 2; this.categories.some((category) => category.slug === slug); suffix += 1) slug = `${root}-${suffix}`;
    return slug;
  }
}

function clean(input: AdminCategoryInput): Omit<AdminProductCategory, "id" | "slug"> {
  return {
    name: input.name,
    visibility: input.visibility,
    ...(input.description ? { description: input.description } : {}),
    ...(input.googleShoppingCategory ? { googleShoppingCategory: input.googleShoppingCategory } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.seoDescription ? { seoDescription: input.seoDescription } : {}),
    ...(input.seoTitle ? { seoTitle: input.seoTitle } : {}),
  };
}

function defaultReferencedIds(): ReadonlySet<string> {
  return new Set(mockAdminProducts.flatMap((product) => product.categoryIds));
}

function failure(code: string, status: number): AdminCategoriesApiError {
  return new AdminCategoriesApiError({ code, message: `Mock category rejected: ${code}.`, status });
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
