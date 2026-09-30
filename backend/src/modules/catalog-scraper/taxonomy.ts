import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

const sourceCategoryMappingSchema = z.object({
  sourceCategory: z.string().trim().min(1),
  sourceUrl: z.url().nullable(),
  normalizedSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  action: z.enum(["keep", "map", "create"]),
}).strict();

export type SourceCategoryMapping = z.infer<typeof sourceCategoryMappingSchema>;

export async function loadApprovedTaxonomy(sourceRoot = resolve(process.cwd(), "source-data")): Promise<{ categories: CategoryArtifact[]; mappings: SourceCategoryMapping[] }> {
  const [taxonomyInput, mappingInput] = await Promise.all([
    readJson(resolve(sourceRoot, "entreno-taxonomy.v1.json")),
    readJson(resolve(sourceRoot, "entreno-source-category-map.v1.json")),
  ]);
  const categories = validateCategoryArtifact(taxonomyInput);
  const mappings = validateSourceCategoryMap(mappingInput, categories);
  return { categories, mappings };
}

export function validateSourceCategoryMap(input: unknown, categories: readonly CategoryArtifact[]): SourceCategoryMapping[] {
  const parsed = z.array(sourceCategoryMappingSchema).safeParse(input);
  if (!parsed.success) throw new Error("Invalid approved source category map.");
  const sourceNames = new Set<string>();
  const sourceUrls = new Set<string>();
  const slugs = new Set(categories.map((category) => category.slug));
  const targets = new Set<string>();
  for (const mapping of parsed.data) {
    if (sourceNames.has(mapping.sourceCategory)) throw new Error(`Duplicate source category mapping: ${mapping.sourceCategory}`);
    if (targets.has(mapping.normalizedSlug)) throw new Error(`Ambiguous canonical category mapping: ${mapping.normalizedSlug}`);
    if (mapping.sourceUrl === null && mapping.sourceCategory !== "ENTRENAMIENTO") throw new Error(`Approved category listing URL is missing: ${mapping.sourceCategory}`);
    if (!slugs.has(mapping.normalizedSlug)) throw new Error(`Unknown canonical category mapping: ${mapping.normalizedSlug}`);
    if (mapping.parentSlug !== null && !slugs.has(mapping.parentSlug)) throw new Error(`Unknown mapped category parent: ${mapping.parentSlug}`);
    if (mapping.sourceUrl && new URL(mapping.sourceUrl).hostname !== "www.entreno.com.ar") throw new Error(`Unapproved source category host: ${mapping.sourceCategory}`);
    if (mapping.sourceUrl && sourceUrls.has(mapping.sourceUrl)) throw new Error(`Duplicate source category URL: ${mapping.sourceCategory}`);
    const target = categories.find((category) => category.slug === mapping.normalizedSlug);
    if (target?.parentSlug !== (mapping.parentSlug ?? undefined)) throw new Error(`Mapped category hierarchy mismatch: ${mapping.normalizedSlug}`);
    sourceNames.add(mapping.sourceCategory);
    targets.add(mapping.normalizedSlug);
    if (mapping.sourceUrl) sourceUrls.add(mapping.sourceUrl);
  }
  if (categories.length !== 61 || parsed.data.length !== 61) throw new Error("Approved taxonomy and source mapping must contain 61 categories.");
  if (targets.size !== categories.length) throw new Error("Approved category mapping does not cover the taxonomy.");
  return [...parsed.data];
}

export function resolveSourceMembership(sourceCategories: readonly string[], artifact: readonly CategoryArtifact[], mappings: readonly SourceCategoryMapping[]): CategoryMembership {
  const bySource = new Map(mappings.map((mapping) => [mapping.sourceCategory, mapping.normalizedSlug]));
  const unknown = sourceCategories.filter((sourceCategory) => !bySource.has(sourceCategory));
  if (unknown.length) throw new Error(`Unknown category drift: ${[...new Set(unknown)].sort().join(", ")}`);
  const resolved = [...new Set(sourceCategories.map((sourceCategory) => bySource.get(sourceCategory)!))];
  return reconcileCategoryMembership(resolved, artifact);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export interface CategoryMembership { sourceSlug: string; categorySlugs: string[]; primarySlug: string; projectionSlugs: string[] }

export function reconcileCategoryMembership(sourceCategories: readonly string[], artifact: readonly CategoryArtifact[], aliases: ReadonlyMap<string, string> = new Map()): CategoryMembership {
  const bySlug = new Map(artifact.map((category) => [category.slug, category]));
  const resolved = [...new Set(sourceCategories.map((value) => aliases.get(value) ?? value).map((value) => value.toLowerCase()))];
  const unknown = resolved.filter((slug) => !bySlug.has(slug));
  if (unknown.length) throw new Error(`Unknown category drift: ${unknown.join(", ")}`);
  const memberships = new Set<string>();
  for (const slug of resolved) { let current: string | undefined = slug; while (current) { memberships.add(current); current = bySlug.get(current)?.parentSlug; } }
  const categorySlugs = [...memberships].sort((left, right) => (bySlug.get(left)?.sortOrder ?? 0) - (bySlug.get(right)?.sortOrder ?? 0) || left.localeCompare(right));
  const primarySlug = resolved[0] ?? categorySlugs[0];
  if (!primarySlug) throw new Error("A product must have an approved category membership.");
  return { sourceSlug: resolved.join(","), categorySlugs, primarySlug, projectionSlugs: resolved };
}

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
