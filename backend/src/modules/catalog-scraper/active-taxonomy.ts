import {
  loadApprovedTaxonomy,
  resolveSourceMembership,
  validateCategoryArtifact,
  type CategoryArtifact,
  type CategoryMembership,
  type SourceCategoryMapping,
} from "./taxonomy";

const OBSOLETE_SHAKER_SLUG = "shakers-y-botellas";
const ACTIVE_SHAKER_SLUG = "shakers";

export const ACTIVE_TAXONOMY_MANY_TO_ONE_MAPPINGS = [
  { targetSlug: ACTIVE_SHAKER_SLUG, sourceCategories: ["SHAKER", "SHAKERS Y BOTELLAS"] },
] as const;

export interface ActiveTaxonomyInput {
  categories: readonly CategoryArtifact[];
  mappings: readonly SourceCategoryMapping[];
}

export interface ActiveTaxonomy {
  categories: CategoryArtifact[];
  mappings: SourceCategoryMapping[];
}

export async function loadActiveTaxonomy(): Promise<ActiveTaxonomy> {
  return createActiveTaxonomy(await loadApprovedTaxonomy());
}

export function createActiveTaxonomy(historical: ActiveTaxonomyInput): ActiveTaxonomy {
  if (historical.categories.length !== 61 || historical.mappings.length !== 61) {
    throw new Error("Historical taxonomy baseline must remain at 61 categories and mappings.");
  }
  const obsoleteCategories = historical.categories.filter((category) => category.slug === OBSOLETE_SHAKER_SLUG);
  if (obsoleteCategories.length !== 1 || !historical.categories.some((category) => category.slug === ACTIVE_SHAKER_SLUG)) {
    throw new Error("Historical shaker taxonomy is missing the approved consolidation source or target.");
  }

  const categories = validateCategoryArtifact(historical.categories
    .filter((category) => category.slug !== OBSOLETE_SHAKER_SLUG)
    .map((category) => category.parentSlug === OBSOLETE_SHAKER_SLUG
      ? { ...category, parentSlug: ACTIVE_SHAKER_SLUG }
      : category));
  if (categories.length !== 60) throw new Error("Active taxonomy must contain exactly 60 categories.");

  const mappings = historical.mappings.map((mapping) => mapping.normalizedSlug === OBSOLETE_SHAKER_SLUG
    ? { ...mapping, action: "map" as const, normalizedSlug: ACTIVE_SHAKER_SLUG }
    : { ...mapping });
  validateActiveMappings(mappings, categories);
  return { categories, mappings };
}

export function validateActiveCategoryArtifact(input: unknown): CategoryArtifact[] {
  const categories = validateCategoryArtifact(input);
  if (categories.length !== 60 || categories.some((category) => category.slug === OBSOLETE_SHAKER_SLUG)
    || !categories.some((category) => category.slug === ACTIVE_SHAKER_SLUG)) {
    throw new Error("Editable taxonomy must use the 60-category active overlay.");
  }
  return categories;
}

export function resolveActiveSourceMembership(
  sourceCategories: readonly string[],
  taxonomy: ActiveTaxonomy,
): CategoryMembership {
  return resolveSourceMembership(sourceCategories, taxonomy.categories, taxonomy.mappings);
}

function validateActiveMappings(mappings: readonly SourceCategoryMapping[], categories: readonly CategoryArtifact[]): void {
  const categoriesBySlug = new Set(categories.map(({ slug }) => slug));
  const sourceNames = new Set<string>();
  const sourceUrls = new Set<string>();
  const mappingsByTarget = new Map<string, string[]>();

  for (const mapping of mappings) {
    if (sourceNames.has(mapping.sourceCategory)) throw new Error(`Duplicate active source category: ${mapping.sourceCategory}`);
    if (!categoriesBySlug.has(mapping.normalizedSlug)) throw new Error(`Active category mapping targets an unknown slug: ${mapping.normalizedSlug}`);
    if (mapping.sourceUrl === null && mapping.sourceCategory !== "ENTRENAMIENTO") throw new Error(`Active source URL is missing: ${mapping.sourceCategory}`);
    if (mapping.sourceUrl && new URL(mapping.sourceUrl).hostname !== "www.entreno.com.ar") throw new Error(`Unapproved active source URL: ${mapping.sourceCategory}`);
    if (mapping.sourceUrl && sourceUrls.has(mapping.sourceUrl)) throw new Error(`Duplicate active source URL: ${mapping.sourceUrl}`);
    sourceNames.add(mapping.sourceCategory);
    if (mapping.sourceUrl) sourceUrls.add(mapping.sourceUrl);
    const targetSources = mappingsByTarget.get(mapping.normalizedSlug) ?? [];
    targetSources.push(mapping.sourceCategory);
    mappingsByTarget.set(mapping.normalizedSlug, targetSources);
  }

  for (const [targetSlug, sourceCategories] of mappingsByTarget) {
    if (sourceCategories.length <= 1) continue;
    const approved = ACTIVE_TAXONOMY_MANY_TO_ONE_MAPPINGS.find((mapping) => mapping.targetSlug === targetSlug);
    if (!approved || [...sourceCategories].sort().join("\0") !== [...approved.sourceCategories].sort().join("\0")) {
      throw new Error(`Unapproved active many-to-one category mapping: ${targetSlug}`);
    }
  }
  if (mappingsByTarget.size !== categories.length) throw new Error("Active source mappings do not cover the 60-category taxonomy.");
}
