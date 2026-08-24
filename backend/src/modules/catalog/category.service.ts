import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CatalogVisibility } from "../../generated/prisma/enums";
import { CatalogRepository } from "./catalog.repository";
import { slugify, type CategoryCreateInput, type CategoryUpdateInput } from "./catalog.schemas";

@Injectable()
export class CategoryService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(input: CategoryCreateInput) {
    return this.catalogRepository.transaction(async (transaction) => {
      if (input.parentId && !await this.catalogRepository.categoryById(transaction, input.parentId)) {
        throw this.notFound();
      }
      const slug = await this.uniqueSlug(transaction, input.slug ?? input.name);
      const categories = await this.catalogRepository.allCategories(transaction);

      return this.catalogRepository.createCategory(transaction, {
        ...input,
        parentId: input.parentId,
        slug,
        sortOrder: categories.length + 1,
        visibility: this.visibility(input.visibility),
      });
    });
  }

  async update(input: CategoryUpdateInput) {
    return this.catalogRepository.transaction(async (transaction) => {
      const current = await this.catalogRepository.categoryById(transaction, input.id);
      if (!current) throw this.notFound();
      const categories = await this.catalogRepository.allCategories(transaction);
      const categoryById = new Map(categories.map((category) => [category.id, category]));
      if (input.parentId && !categoryById.has(input.parentId)) throw this.notFound();
      if (this.wouldCreateCycle(input.id, input.parentId, categoryById)) throw this.categoryCycle();
      const slug = input.slug === undefined || input.slug === current.slug
        ? input.slug ?? current.slug
        : await this.uniqueSlug(transaction, input.slug, input.id);

      return this.catalogRepository.updateCategory(transaction, input.id, {
        ...input,
        parentId: input.parentId,
        slug,
        visibility: this.visibility(input.visibility),
      });
    });
  }

  async setVisibility(id: string, visibility: "hidden" | "visible"): Promise<void> {
    await this.catalogRepository.transaction(async (transaction) => {
      const current = await this.catalogRepository.categoryById(transaction, id);
      if (!current) throw this.notFound();
      const ids = visibility === "hidden"
        ? this.descendantIds(id, await this.catalogRepository.allCategories(transaction))
        : [id];
      await this.catalogRepository.setCategoryVisibility(transaction, ids, this.visibility(visibility));
    });
  }

  async delete(id: string): Promise<void> {
    await this.catalogRepository.transaction(async (transaction) => {
      if (!await this.catalogRepository.categoryById(transaction, id)) throw this.notFound();
      const ids = this.descendantIds(id, await this.catalogRepository.allCategories(transaction));
      if (await this.catalogRepository.countCategoryReferences(transaction, ids)) throw this.categoryInUse();
      await this.catalogRepository.deleteCategories(transaction, [...ids].reverse());
    });
  }

  async setOrder(categoryIds: readonly string[]): Promise<void> {
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new ConflictException({ code: ERROR_CODE.CONFLICT, message: "Category order must contain stable IDs only once.", ok: false });
    }
    await this.catalogRepository.transaction(async (transaction) => {
      const categories = await this.catalogRepository.allCategories(transaction);
      if (categories.length !== categoryIds.length || !categoryIds.every((id) => categories.some((category) => category.id === id))) {
        throw new ConflictException({ code: ERROR_CODE.CONFLICT, message: "Category order must contain every persisted category ID.", ok: false });
      }
      await this.catalogRepository.setCategoryOrder(transaction, categoryIds);
    });
  }

  private descendantIds(id: string, categories: readonly { id: string; parentId: string | null }[]): string[] {
    const ids = [id];
    for (let index = 0; index < ids.length; index += 1) {
      const parentId = ids[index];
      for (const category of categories) {
        if (category.parentId === parentId) ids.push(category.id);
      }
    }
    return ids;
  }

  private async uniqueSlug(transaction: Parameters<CatalogRepository["categoryById"]>[0], value: string, ignoredId?: string): Promise<string> {
    const root = slugify(value);
    let candidate = root;
    let suffix = 2;
    while (true) {
      const existing = await this.catalogRepository.categoryBySlug(transaction, candidate);
      if (!existing || existing.id === ignoredId) return candidate;
      candidate = `${root}-${suffix}`;
      suffix += 1;
    }
  }

  private visibility(value: "hidden" | "visible"): CatalogVisibility {
    return value === "hidden" ? CatalogVisibility.HIDDEN : CatalogVisibility.VISIBLE;
  }

  private wouldCreateCycle(
    id: string,
    parentId: string | undefined,
    categoryById: ReadonlyMap<string, { parentId: string | null }>,
  ): boolean {
    const visited = new Set<string>();
    let currentId = parentId;
    while (currentId) {
      if (currentId === id || visited.has(currentId)) return true;
      visited.add(currentId);
      currentId = categoryById.get(currentId)?.parentId ?? undefined;
    }
    return false;
  }

  private categoryCycle(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.CATEGORY_CYCLE, message: "A category cannot become its own ancestor.", ok: false });
  }

  private categoryInUse(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.CATEGORY_IN_USE, message: "Products reference this category hierarchy.", ok: false });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested category was not found.", ok: false });
  }
}
