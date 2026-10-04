import { CatalogVisibility } from "../../generated/prisma/enums";
import { slugify } from "./catalog.schemas";
import type { CatalogProduct, PublicCatalogCategory } from "./catalog.mapper";
import type { PublicProductListQuery } from "./catalog.schemas";

export interface PublicListingFacet {
  count: number;
  label: string;
  slug: string;
}

export interface PublicListingMetadata {
  facets: {
    brands: PublicListingFacet[];
    categories: PublicListingFacet[];
    subcategories: PublicListingFacet[];
  };
  priceBounds: { max: number; min: number };
}

export function publicListingScope(
  products: readonly CatalogProduct[],
  categories: readonly PublicCatalogCategory[],
  categorySlug?: string,
  brandSlug?: string,
): CatalogProduct[] {
  const visibleIds = new Set(categories.map(({ id }) => id));
  const routeCategory = categorySlug ? categories.find(({ slug }) => slug === categorySlug) : undefined;
  if (categorySlug && !routeCategory) return [];
  const categoryIds = new Set<string>();
  if (routeCategory) {
    categoryIds.add(routeCategory.id);
    for (const category of categories) {
      let parentId = category.parentId;
      while (parentId) {
        if (parentId === routeCategory.id) {
          categoryIds.add(category.id);
          break;
        }
        parentId = categories.find((candidate) => candidate.id === parentId)?.parentId;
      }
    }
  }
  return products.filter((product) => product.visibility === CatalogVisibility.VISIBLE
    && (!brandSlug || slugify(product.brand ?? "entrenar") === brandSlug)
    && product.categories.some(({ categoryId }) => visibleIds.has(categoryId)
      && (!routeCategory || categoryIds.has(categoryId))));
}

export function filterPublicListing(
  products: readonly CatalogProduct[],
  query: PublicProductListQuery,
  categories: readonly PublicCatalogCategory[],
): CatalogProduct[] {
  const search = query.search?.toLocaleLowerCase();
  const brandSlugs = new Set([...(query.brandSlug ? [query.brandSlug] : []), ...(query.brandSlugs ?? [])]);
  const categorySlugs = new Set(query.categorySlugs ?? []);
  const publicCategorySlugs = new Set(categories.map(({ slug }) => slug));
  const subcategorySlugs = new Set(query.subcategorySlugs ?? []);
  return products.filter((product) => {
    const brandSlug = slugify(product.brand ?? "entrenar");
    const price = Number(product.price);
    if (brandSlugs.size > 0 && !brandSlugs.has(brandSlug)) return false;
    if (categorySlugs.size > 0 && !product.categories.some(({ category }) => publicCategorySlugs.has(category.slug) && categorySlugs.has(category.slug))) return false;
    if (subcategorySlugs.size > 0 && ![...subcategorySlugs].some((slug) => publicCategorySlugs.has(slug)
      ? publicListingScope([product], categories, slug).length > 0
      : productSubcategories(product, categories).includes(slug))) return false;
    if (query.minPrice !== undefined && price < query.minPrice) return false;
    if (query.maxPrice !== undefined && price > query.maxPrice) return false;
    if (query.offersOnly && !(product.compareAtPrice !== null && Number(product.compareAtPrice) > price)) return false;
    if (search && ![product.name, product.brand, product.description, product.shortDescription, ...stringArray(product.tags)]
      .some((value) => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  });
}

export function publicListingMetadata(
  scope: readonly CatalogProduct[],
  categories: readonly PublicCatalogCategory[],
  categorySlug?: string,
): PublicListingMetadata {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const brands = new Map<string, PublicListingFacet>();
  const categoryCounts = new Map<string, PublicListingFacet>();
  const subcategoryCounts = new Map<string, PublicListingFacet>();
  const uniqueProducts = uniqueById(scope);
  const prices = uniqueProducts.map((product) => Number(product.price)).filter(Number.isFinite);

  for (const product of uniqueProducts) {
    const label = product.brand?.trim() || "EntrenAR";
    incrementFacet(brands, slugify(label), label);
    const uniqueCategories = new Set(product.categories.map(({ categoryId }) => categoryById.get(categoryId)?.slug).filter(isString));
    for (const slug of uniqueCategories) {
      const category = categories.find((entry) => entry.slug === slug);
      incrementFacet(categoryCounts, slug, category?.name ?? slug);
    }
    const parent = categories.find((category) => category.slug === categorySlug);
    for (const slug of productSubcategories(product, categories)) {
      const child = categories.find((category) => category.slug === slug);
      if (parent && child && child.parentId !== parent.id) continue;
      incrementFacet(subcategoryCounts, slug, child?.name ?? slug);
    }
  }

  return {
    facets: {
      brands: [...brands.values()].sort(compareFacet),
      categories: [...categoryCounts.values()].sort(compareFacet),
      subcategories: [...subcategoryCounts.values()].sort(compareFacet),
    },
    priceBounds: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 },
  };
}

export function publicBrandDirectory(scope: readonly CatalogProduct[]): PublicListingFacet[] {
  const brands = new Map<string, PublicListingFacet>();
  for (const product of uniqueById(scope)) {
    const label = product.brand?.trim() || "EntrenAR";
    incrementFacet(brands, slugify(label), label);
  }
  return [...brands.values()].sort(compareFacet);
}

function productSubcategories(product: CatalogProduct, categories: readonly PublicCatalogCategory[]): string[] {
  const canonical = new Set<string>();
  for (const { categoryId } of product.categories) {
    let category = categories.find((entry) => entry.id === categoryId);
    for (let depth = 0; category?.parentId && depth < categories.length; depth++) {
      canonical.add(category.slug);
      category = categories.find((entry) => entry.id === category?.parentId);
    }
  }
  return canonical.size ? [...canonical] : [...new Set(stringArray(product.subcategorySlugs))]
    .filter((slug) => !categories.some((category) => category.slug === slug));
}

function uniqueById(products: readonly CatalogProduct[]): CatalogProduct[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function incrementFacet(facets: Map<string, PublicListingFacet>, slug: string, label: string): void {
  const facet = facets.get(slug);
  if (facet) facet.count += 1;
  else facets.set(slug, { count: 1, label, slug });
}

function compareFacet(left: PublicListingFacet, right: PublicListingFacet): number {
  return left.label.localeCompare(right.label) || left.slug.localeCompare(right.slug);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
