import { normalizeCatalogImportManifest, type CatalogImportManifest } from "../catalog-import/manifest-validator";
import type { CategoryArtifact, SourceCategoryMapping } from "./taxonomy";
import type { ExtractedProduct } from "./scraper";

export interface TransformResult { manifest?: CatalogImportManifest; warnings: string[]; exclusions: Array<{ code: string; product: string; message: string }> }
export interface TransformTaxonomy { categories: readonly CategoryArtifact[]; mappings: readonly SourceCategoryMapping[] }

export function canonicalSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function canonicalProductSlug(url: string, name: string): string {
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    if (segment) return canonicalSlug(decodeURIComponent(segment));
  } catch { /* fall back only when the source URL has no usable identity */ }
  return canonicalSlug(name);
}

export function transformProducts(products: readonly ExtractedProduct[], taxonomy?: TransformTaxonomy): TransformResult {
  const warnings: string[] = [];
  const exclusions: TransformResult["exclusions"] = [];
  const sources = [...products].sort((left, right) => left.url.localeCompare(right.url));
  const owners = new Map<string, Set<string>>();
  for (const product of sources) {
    for (const variant of product.sourceProduct?.variants ?? []) {
      const sku = variant.sku.trim();
      if (!sku) continue;
      const skuOwners = owners.get(sku) ?? new Set<string>();
      skuOwners.add(product.url);
      owners.set(sku, skuOwners);
    }
  }
  const conflicted = new Set<string>();
  for (const [sku, skuOwners] of owners) {
    if (skuOwners.size > 1) {
      for (const owner of skuOwners) conflicted.add(owner);
      exclusions.push({ code: "DUPLICATE_SKU_CONFLICT", product: [...skuOwners].map((url) => canonicalProductSlug(url, url)).sort().join(","), message: `SKU ${sku} has multiple product owners.` });
    }
  }

  const raw: CatalogImportManifest = { products: [] };
  const categoryBySlug = new Map((taxonomy?.categories ?? []).map((category) => [category.slug, category]));
  const mappingBySource = new Map((taxonomy?.mappings ?? []).map((mapping) => [mapping.sourceCategory, mapping.normalizedSlug]));
  for (const source of sources) {
    const sourceProduct = source.sourceProduct;
    const slug = canonicalProductSlug(source.url, source.name);
    if (conflicted.has(source.url)) continue;
    if (!sourceProduct) {
      exclusions.push({ code: "MISSING_STRUCTURED_SOURCE", product: slug, message: "Product has no decoded structured source state." });
      continue;
    }
    if (!sourceProduct.variants.length) {
      exclusions.push({ code: "MISSING_VARIANTS", product: slug, message: "Source product has no variants." });
      continue;
    }
    if (!sourceProduct.gallery.length) {
      exclusions.push({ code: "INVALID_IMAGE_ASSET", product: slug, message: "Source product has no selected gallery images." });
      continue;
    }
    if (sourceProduct.variants.some((variant) => !variant.sku.trim())) {
      exclusions.push({ code: "MISSING_SKU", product: slug, message: "Every source variant must have an SKU." });
      continue;
    }
    const variantSkus = new Set(sourceProduct.variants.map((variant) => variant.sku));
    if (variantSkus.size !== sourceProduct.variants.length) {
      exclusions.push({ code: "DUPLICATE_SKU_CONFLICT", product: slug, message: "Product contains repeated variant SKUs." });
      continue;
    }
    const rawPrices = sourceProduct.variants.map((variant) => variant.price);
    if (rawPrices.some((price) => price === undefined)) {
      exclusions.push({ code: "MISSING_PRICE", product: slug, message: "Every source variant must have a current price." });
      continue;
    }
    if (rawPrices.some((price) => price! <= 0)) {
      exclusions.push({ code: "INVALID_PRICE", product: slug, message: "Source variant prices must be positive." });
      continue;
    }
    const sourcePrices = [...new Set(rawPrices as number[])];
    if (sourcePrices.length !== 1) {
      exclusions.push({ code: "PRICE_VARIANCE_UNSUPPORTED", product: slug, message: `Variant prices cannot be represented by one product price: ${sourceProduct.variants.map((variant) => `${variant.sku}=${variant.price}`).join(", ")}.` });
      continue;
    }
    const compareAtValues = [...new Set(sourceProduct.variants.flatMap((variant) => variant.compareAtPrice === undefined ? [] : [variant.compareAtPrice]))];
    if (compareAtValues.some((price) => price <= 0)) {
      exclusions.push({ code: "INVALID_COMPARE_AT_PRICE", product: slug, message: "Source compare-at prices must be positive." });
      continue;
    }
    if (compareAtValues.length > 1) {
      exclusions.push({ code: "COMPARE_AT_INCOMPATIBLE", product: slug, message: `Variant compare-at prices conflict: ${sourceProduct.variants.map((variant) => `${variant.sku}=${variant.compareAtPrice ?? "none"}`).join(", ")}.` });
      continue;
    }

    const properties = buildProperties(sourceProduct.variants.map((variant) => ({ id: variant.id, options: variant.options })));
    if (!properties.ok) {
      exclusions.push({ code: properties.code, product: slug, message: properties.message });
      continue;
    }
    const categorySlugs = new Set<string>();
    let unknownCategory: string | undefined;
    for (const category of sourceProduct.categories) {
      const canonical = mappingBySource.get(category.sourceCategory);
      if (!canonical) { unknownCategory = category.sourceCategory; break; }
      let current: string | undefined = canonical;
      while (current) {
        categorySlugs.add(current);
        current = categoryBySlug.get(current)?.parentSlug;
      }
    }
    if (unknownCategory) throw new Error(`Unknown category drift: ${unknownCategory}`);
    const orderedCategories = [...categorySlugs].sort((left, right) => (categoryBySlug.get(left)?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (categoryBySlug.get(right)?.sortOrder ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right));
    if (!orderedCategories.length) {
      exclusions.push({ code: "MISSING_CATEGORY", product: slug, message: "Product has no approved category membership." });
      continue;
    }
    const measurements = sourceProduct.variants.map((variant) => variant.logistics);
    if (measurements.some((logistics) => [logistics.weightGrams, logistics.heightCm, logistics.widthCm, logistics.lengthCm].some((value) => value !== undefined && value < 0))) {
      exclusions.push({ code: "INVALID_LOGISTICS", product: slug, message: "Source logistics values cannot be negative." });
      continue;
    }
    const weights = measurements.map((logistics) => logistics.weightGrams).filter((value): value is number => value !== undefined && value > 0);
    if (!weights.length) {
      exclusions.push({ code: "MISSING_WEIGHT", product: slug, message: "Product has no positive source weight." });
      continue;
    }
    const weight = Math.max(...weights);
    const heights = sourceProduct.variants.map((variant) => variant.logistics.heightCm).filter(isPositiveNumber);
    const widths = sourceProduct.variants.map((variant) => variant.logistics.widthCm).filter(isPositiveNumber);
    const lengths = sourceProduct.variants.map((variant) => variant.logistics.lengthCm).filter(isPositiveNumber);
    if (!heights.length || !widths.length || !lengths.length) warnings.push(`Missing dimensions: ${slug}`);
    if (compareAtValues.length === 0 || compareAtValues[0]! <= sourcePrices[0]!) warnings.push(`No valid promotional compare-at price: ${slug}`);
    const images = sourceProduct.gallery.map((image, index) => ({ storageKey: `products/${slug}/${index + 1}.webp`, position: index + 1, alt: sourceProduct.name }));
    const imageKeyById = new Map(sourceProduct.gallery.map((image, index) => [image.id, images[index]!.storageKey]));
    const product: CatalogImportManifest["products"][number] = {
      slug,
      publicSlug: slug,
      name: sourceProduct.name,
      ...(sourceProduct.brand ? { brand: sourceProduct.brand } : {}),
      descriptionHtml: sourceProduct.descriptionHtml,
      price: sourcePrices[0]!,
      ...(compareAtValues[0] !== undefined && compareAtValues[0] > sourcePrices[0]! ? { compareAtPrice: compareAtValues[0] } : {}),
      variantProperties: properties.values,
      categorySlugs: orderedCategories,
      images,
      variants: sourceProduct.variants.map((variant) => ({
        sku: variant.sku,
        attributes: properties.attributeSets.get(variant.id) ?? {},
        stockMode: variant.stockMode,
        ...(variant.stockMode === "TRACKED" ? { quantity: variant.quantity! } : {}),
        ...(variant.imageId ? { primaryImageStorageKey: imageKeyById.get(variant.imageId)! } : {}),
      })),
      tags: [],
      shippingRequired: true,
      weightGrams: weight,
      ...(heights.length ? { heightCm: Math.max(...heights) } : {}),
      ...(widths.length ? { widthCm: Math.max(...widths) } : {}),
      ...(lengths.length ? { lengthCm: Math.max(...lengths) } : {}),
    };
    raw.products.push(product);
  }
  if (raw.products.length === 0) return { warnings, exclusions };
  try {
    normalizeCatalogImportManifest(raw);
    return { manifest: raw, warnings, exclusions };
  } catch (error) {
    exclusions.push({ code: "INVALID_MANIFEST", product: "*", message: error instanceof Error ? error.message : "Invalid canonical manifest." });
    return { warnings, exclusions };
  }
}

type PropertyBuild = { ok: true; values: CatalogImportManifest["products"][number]["variantProperties"]; attributeSets: Map<string, Record<string, string>> } | { ok: false; code: string; message: string };

function buildProperties(variants: readonly { id: string; options: Record<string, string> }[]): PropertyBuild {
  const names = [...new Set(variants.flatMap((variant) => Object.keys(variant.options)))];
  if (names.length > 2) return { ok: false, code: "UNSUPPORTED_VARIANT_SHAPE", message: "Source product requires more than two variant properties." };
  const propertyIds = new Map<string, string>();
  const properties: CatalogImportManifest["products"][number]["variantProperties"] = [];
  const normalizedValues = new Map<string, Map<string, string>>();
  for (const name of names) {
    const id = canonicalSlug(name);
    if (!id || (propertyIds.has(id) && propertyIds.get(id) !== name)) return { ok: false, code: "NORMALIZATION_COLLISION", message: "Distinct option names normalize to the same property ID." };
    propertyIds.set(id, name);
    const valueLabels = [...new Set(variants.flatMap((variant) => variant.options[name] === undefined ? [] : [variant.options[name]!]))];
    const valueIds = new Map<string, string>();
    for (const label of valueLabels) {
      const valueId = canonicalSlug(label);
      if (!valueId || (valueIds.has(valueId) && valueIds.get(valueId) !== label)) return { ok: false, code: "NORMALIZATION_COLLISION", message: `Distinct values for ${name} normalize to the same ID.` };
      valueIds.set(valueId, label);
    }
    normalizedValues.set(name, new Map(valueLabels.map((label) => [label, canonicalSlug(label)])));
    properties.push({ id, name, values: valueLabels.map((label) => ({ id: canonicalSlug(label), label })) });
  }
  const attributeSets = new Map<string, Record<string, string>>();
  variants.forEach((variant) => {
    const attributes: Record<string, string> = {};
    for (const name of names) {
      const value = variant.options[name];
      if (value === undefined) continue;
      attributes[canonicalSlug(name)] = normalizedValues.get(name)!.get(value)!;
    }
    attributeSets.set(variant.id, attributes);
  });
  return { ok: true, values: properties, attributeSets };
}

function isPositiveNumber(value: number | undefined): value is number { return value !== undefined && value > 0; }
