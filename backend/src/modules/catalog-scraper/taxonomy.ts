import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { CatalogVisibility } from "../../generated/prisma/enums";
import { CatalogRepository } from "../catalog/catalog.repository";

const categoryVisibility = z.enum(["visible", "hidden"]);
export const categoryArtifactSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  parentSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  visibility: categoryVisibility,
  sortOrder: z.number().int().nonnegative(),
}).strict();

export type CategoryArtifact = z.infer<typeof categoryArtifactSchema>;

export function validateCategoryArtifact(input: unknown): CategoryArtifact[] {
  const parsed = z.array(categoryArtifactSchema).safeParse(input);
  if (!parsed.success) throw new Error("Invalid category artifact.");
  const bySlug = new Map<string, CategoryArtifact>();
  for (const category of parsed.data) {
    if (bySlug.has(category.slug)) throw new Error(`Duplicate category slug: ${category.slug}`);
    bySlug.set(category.slug, category);
  }
  for (const category of parsed.data) {
    if (category.parentSlug && !bySlug.has(category.parentSlug)) throw new Error(`Unknown category parent: ${category.parentSlug}`);
    const visited = new Set<string>();
    let current = category.parentSlug;
    while (current) {
      if (current === category.slug || visited.has(current)) throw new Error(`Category cycle: ${category.slug}`);
      visited.add(current);
      current = bySlug.get(current)?.parentSlug;
    }
  }
  return [...parsed.data].sort((left, right) => left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug));
}

@Injectable()
export class CatalogTaxonomySyncService {
  constructor(private readonly repository: CatalogRepository) {}

  async sync(input: unknown): Promise<{ created: number; updated: number; unchanged: number }> {
    const artifact = validateCategoryArtifact(input);
    return this.repository.transaction(async (transaction) => {
      const existing = await this.repository.allCategories(transaction);
      const bySlug = new Map(existing.map((category) => [category.slug, category]));
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      const ids = new Map(existing.map((category) => [category.slug, category.id]));
      for (const category of artifact) {
        const parentId = category.parentSlug ? ids.get(category.parentSlug) : undefined;
        const visibility = category.visibility === "visible" ? CatalogVisibility.VISIBLE : CatalogVisibility.HIDDEN;
        const current = bySlug.get(category.slug);
        if (!current) {
          const record = await this.repository.createCategory(transaction, {
            name: category.name,
            slug: category.slug,
            parentId,
            sortOrder: category.sortOrder,
            visibility,
          });
          ids.set(category.slug, record.id);
          created += 1;
          continue;
        }
        ids.set(category.slug, current.id);
        if (current.name === category.name && current.parentId === (parentId ?? null) && current.sortOrder === category.sortOrder && current.visibility === visibility) {
          unchanged += 1;
        } else {
          await this.repository.updateCategory(transaction, current.id, {
            name: category.name,
            parentId,
            slug: category.slug,
            visibility,
          });
          await transaction.category.update({ where: { id: current.id }, data: { sortOrder: category.sortOrder } });
          updated += 1;
        }
      }
      return { created, updated, unchanged };
    });
  }
}
