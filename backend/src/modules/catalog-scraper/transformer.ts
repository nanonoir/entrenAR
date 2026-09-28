import { normalizeCatalogImportManifest, type CatalogImportManifest } from "../catalog-import/manifest-validator";
import type { ExtractedProduct } from "./scraper";

export interface TransformResult { manifest?: ReturnType<typeof normalizeCatalogImportManifest>; warnings: string[]; exclusions: Array<{ code: string; product: string; message: string }> }

export function canonicalSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function transformProducts(products: readonly ExtractedProduct[], categoryMap = new Map<string, string>()): TransformResult {
  const warnings: string[] = [];
  const exclusions: TransformResult["exclusions"] = [];
  const skuOwners = new Map<string, string>();
  const raw: CatalogImportManifest = { products: [] };
  for (const source of [...products].sort((left, right) => left.url.localeCompare(right.url))) {
    const slug = canonicalSlug(source.name);
    const sku = source.sku?.trim() || `${slug}-default`;
    const previous = skuOwners.get(sku);
    if (previous) {
      exclusions.push({ code: "DUPLICATE_SKU", product: slug, message: `SKU ${sku} is also owned by ${previous}.` });
      continue;
    }
    skuOwners.set(sku, slug);
    const weight = maxMeasurement(source.variants, "weightGrams");
    if (!weight) {
      exclusions.push({ code: "MISSING_WEIGHT", product: slug, message: "Product has no positive variant weight." });
      continue;
    }
    const dimensions = {
      heightCm: maxMeasurement(source.variants, "heightCm"),
      widthCm: maxMeasurement(source.variants, "widthCm"),
      lengthCm: Math.max(maxMeasurement(source.variants, "lengthCm") ?? 0, maxMeasurement(source.variants, "depth") ?? 0) || undefined,
    };
    if (!dimensions.heightCm || !dimensions.widthCm || !dimensions.lengthCm) warnings.push(`Missing dimensions: ${slug}`);
    raw.products.push({
      slug,
      publicSlug: slug,
      name: source.name,
      descriptionHtml: source.descriptionHtml,
      price: source.price ?? 1,
      ...(source.compareAtPrice ? { compareAtPrice: source.compareAtPrice } : {}),
      variantProperties: [],
      categorySlugs: source.categories.map((category) => categoryMap.get(category) ?? canonicalSlug(category)).filter(Boolean),
      images: source.images.map((_, index) => ({ storageKey: `products/${slug}/${index + 1}.webp`, position: index + 1, alt: source.name })),
      variants: [{ sku, attributes: {}, stockMode: "TRACKED", quantity: 0 }],
      tags: [],
      shippingRequired: true,
      weightGrams: weight,
      ...dimensions,
    });
  }
  if (raw.products.length === 0) return { warnings, exclusions };
  try { return { manifest: normalizeCatalogImportManifest(raw), warnings, exclusions }; } catch (error) {
    exclusions.push({ code: "INVALID_MANIFEST", product: "*", message: error instanceof Error ? error.message : "Invalid canonical manifest." });
    return { warnings, exclusions };
  }
}

function maxMeasurement(variants: readonly unknown[], key: string): number | undefined {
  const values = variants.map((variant) => typeof variant === "object" && variant !== null ? Number((variant as Record<string, unknown>)[key]) : 0).filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? Math.max(...values) : undefined;
}
