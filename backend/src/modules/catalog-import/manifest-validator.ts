import { z } from "zod";

const STOCK_MODE = {
  TRACKED: "TRACKED",
  INFINITE: "INFINITE",
} as const;

type StockMode = (typeof STOCK_MODE)[keyof typeof STOCK_MODE];

const slugSchema = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const moneySchema = z.number().finite().positive();
const positiveMeasurementSchema = z.number().finite().positive();
const propertyValueSchema = z.object({ id: slugSchema, label: z.string().trim().min(1) });
const propertySchema = z.object({ id: slugSchema, name: z.string().trim().min(1), values: z.array(propertyValueSchema).min(1) });
const imageSchema = z.object({
  storageKey: z.string().trim().min(1),
  position: z.number().int().positive(),
  alt: z.string().trim().optional(),
}).strict();

const variantSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  attributes: z.record(z.string(), slugSchema).default({}),
  stockMode: z.enum([STOCK_MODE.TRACKED, STOCK_MODE.INFINITE]),
  quantity: z.number().int().nonnegative().optional(),
  primaryImageStorageKey: z.string().trim().min(1).optional(),
}).strict();

const productSchema = z.object({
  slug: slugSchema,
  publicSlug: slugSchema.optional(),
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional(),
  descriptionHtml: z.string().optional(),
  shortDescription: z.string().trim().optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  variantProperties: z.array(propertySchema).default([]),
  categorySlugs: z.array(slugSchema).min(1),
  images: z.array(imageSchema).min(1),
  variants: z.array(variantSchema).min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  shippingRequired: z.boolean().default(true),
  weightGrams: positiveMeasurementSchema,
  heightCm: positiveMeasurementSchema.optional(),
  widthCm: positiveMeasurementSchema.optional(),
  lengthCm: positiveMeasurementSchema.optional(),
}).strict();

export const catalogImportManifestSchema = z.object({
  products: z.array(productSchema).min(1),
});

export type CatalogImportManifest = z.infer<typeof catalogImportManifestSchema>;
export type CatalogImportProduct = CatalogImportManifest["products"][number];
export type CatalogImportVariant = CatalogImportProduct["variants"][number];

export interface CatalogImportIssue {
  productSlug?: string;
  field?: string;
  key?: string;
  code: string;
  message: string;
}

export interface CatalogImportPlan extends CatalogImportManifest {
  products: Array<CatalogImportProduct & { publicSlug: string; descriptionHtml: string; missingLogistics: boolean }>;
  skuSet: Set<string>;
}

export class CatalogManifestValidationError extends Error {
  constructor(public readonly issues: readonly CatalogImportIssue[]) {
    super("Catalog import manifest validation failed.");
    this.name = "CatalogManifestValidationError";
  }
}

export function normalizeCatalogImportManifest(input: unknown): CatalogImportPlan {
  const parsed = catalogImportManifestSchema.safeParse(input);
  if (!parsed.success) {
    throw new CatalogManifestValidationError(parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      code: "INVALID_MANIFEST",
      message: issue.message,
    })));
  }

  const issues: CatalogImportIssue[] = [];
  const slugs = new Set<string>();
  const publicSlugs = new Set<string>();
  const skuSet = new Set<string>();
  const products = parsed.data.products.map((product) => {
    if (slugs.has(product.slug)) issues.push(issue(product.slug, "slug", "DUPLICATE_SLUG", "Product slug is duplicated."));
    const publicSlug = product.publicSlug ?? product.slug;
    if (publicSlugs.has(publicSlug)) issues.push(issue(product.slug, "publicSlug", "DUPLICATE_PUBLIC_SLUG", "Public slug is duplicated."));
    slugs.add(product.slug);
    publicSlugs.add(publicSlug);

    if (product.compareAtPrice !== undefined && product.compareAtPrice <= product.price) {
      issues.push(issue(product.slug, "compareAtPrice", "INVALID_COMPARE_AT_PRICE", "Compare-at price must be greater than price."));
    }
    if (product.variantProperties.length > 2) issues.push(issue(product.slug, "variantProperties", "TOO_MANY_PROPERTIES", "A product may declare at most two properties."));
    if (new Set(product.categorySlugs).size !== product.categorySlugs.length) issues.push(issue(product.slug, "categorySlugs", "DUPLICATE_CATEGORY", "Category slugs must be unique per product."));

    const propertyIds = new Set<string>();
    for (const property of product.variantProperties) {
      if (propertyIds.has(property.id)) issues.push(issue(product.slug, "variantProperties", "DUPLICATE_PROPERTY", "Variant property IDs must be unique."));
      propertyIds.add(property.id);
      if (new Set(property.values.map((value) => value.id)).size !== property.values.length) {
        issues.push(issue(product.slug, "variantProperties", "DUPLICATE_PROPERTY_VALUE", "Variant property value IDs must be unique."));
      }
    }

    const positions = new Set<number>();
    for (const image of product.images) {
      if (positions.has(image.position)) issues.push(issue(product.slug, "images", "DUPLICATE_IMAGE_POSITION", "Gallery positions must be unique."));
      positions.add(image.position);
      const expected = `products/${product.slug}/${image.position}.webp`;
      if (image.storageKey !== expected) issues.push(issue(product.slug, "images", "INVALID_STORAGE_KEY", "Gallery keys must use the canonical product path.", image.storageKey));
    }

    const combinations = new Set<string>();
    for (const variant of product.variants) {
      if (variant.stockMode === STOCK_MODE.TRACKED && variant.quantity === undefined) {
        issues.push(issue(product.slug, "variants.quantity", "MISSING_QUANTITY", "Tracked variants require a non-negative quantity."));
      }
      if (variant.stockMode === STOCK_MODE.INFINITE && variant.quantity !== undefined) {
        issues.push(issue(product.slug, "variants.quantity", "UNEXPECTED_QUANTITY", "Infinite variants must not define quantity."));
      }
      const combination = JSON.stringify(Object.entries(variant.attributes).sort(([left], [right]) => left.localeCompare(right)));
      if (combinations.has(combination)) issues.push(issue(product.slug, "variants.attributes", "DUPLICATE_COMBINATION", "Variant combinations must be unique."));
      combinations.add(combination);
      const attributeKeys = Object.keys(variant.attributes);
      if (attributeKeys.length !== product.variantProperties.length || product.variantProperties.some((property) => !attributeKeys.includes(property.id))) {
        issues.push(issue(product.slug, "variants.attributes", "INVALID_ATTRIBUTE_SET", "Each variant must define exactly one value for every declared property."));
      }
      if (attributeKeys.some((key) => !product.variantProperties.some((property) => property.id === key))) {
        issues.push(issue(product.slug, "variants.attributes", "UNKNOWN_PROPERTY", "Variant attributes must use declared properties."));
      }
      for (const property of product.variantProperties) {
        const valueId = variant.attributes[property.id];
        if (valueId && !property.values.some((value) => value.id === valueId)) {
          issues.push(issue(product.slug, "variants.attributes", "UNKNOWN_PROPERTY_VALUE", "Variant attributes must use declared property values."));
        }
      }
      if (variant.primaryImageStorageKey !== undefined && !product.images.some((image) => image.storageKey === variant.primaryImageStorageKey)) {
        issues.push(issue(product.slug, "variants.primaryImageStorageKey", "FOREIGN_PRIMARY_IMAGE", "Variant primary image must belong to the product gallery."));
      }
      if (skuSet.has(variant.sku)) issues.push(issue(product.slug, "variants.sku", "DUPLICATE_SKU", "Variant SKU must be globally unique.", variant.sku));
      skuSet.add(variant.sku);
    }

    if (product.variantProperties.length === 0 && (product.variants.length !== 1 || Object.keys(product.variants[0]!.attributes).length !== 0)) {
      issues.push(issue(product.slug, "variants", "INVALID_SIMPLE_PRODUCT", "A simple product must contain exactly one empty-attribute variant."));
    }

    return {
      ...product,
      publicSlug,
      descriptionHtml: sanitizeHtml(product.descriptionHtml ?? ""),
      missingLogistics: product.heightCm === undefined || product.widthCm === undefined || product.lengthCm === undefined,
    };
  });

  if (issues.length > 0) throw new CatalogManifestValidationError(issues);
  return { products, skuSet };
}

function issue(productSlug: string, field: string, code: string, message: string, key?: string): CatalogImportIssue {
  return { productSlug, field, ...(key ? { key } : {}), code, message };
}

const SAFE_TAGS = new Set(["a", "br", "em", "h2", "h3", "li", "ol", "p", "strong", "ul"]);

export function sanitizeHtml(value: string): string {
  return value
    .replace(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi, (tag, name: string) => {
      if (!SAFE_TAGS.has(name.toLowerCase())) return "";
      if (tag.startsWith("</")) return `</${name.toLowerCase()}>`;
      if (name.toLowerCase() === "br") return "<br>";
      if (name.toLowerCase() === "a") {
        const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
        return href && /^(https?:|mailto:)/i.test(href) ? `<a href="${href}">` : "<a>";
      }
      return `<${name.toLowerCase()}>`;
    })
    .replace(/javascript:/gi, "");
}

export function stockModeForVariant(variant: CatalogImportVariant): StockMode {
  return variant.stockMode;
}
