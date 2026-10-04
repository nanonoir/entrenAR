import { z } from "zod";

import {
  CATALOG_ADMIN_PRODUCT_SORT,
  CATALOG_PUBLIC_PRODUCT_SORT,
  CATALOG_STOCK_MODE,
  CATALOG_VISIBILITY,
} from "./catalog.constants";

const catalogVisibilityValues = Object.values(CATALOG_VISIBILITY) as [
  (typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY],
  ...(typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY][],
];

export const identifierSchema = z.string().trim().min(1).max(128);
const optionalTextSchema = z.string().trim().min(1).max(500).optional();
const optionalSlugSchema = z.string().trim().min(1).max(160).optional();
const moneySchema = z.number().finite().positive().multipleOf(0.01);
const optionalMoneySchema = moneySchema.optional();
const optionalPositiveIntegerSchema = z.number().int().positive().optional();
const csvSlugSchema = z.string().trim().max(4_000).optional().transform((value) => {
  if (!value) return undefined;
  const slugs = value.split(",").map((slug) => slug.trim()).filter(Boolean);
  return [...new Set(slugs)];
}).pipe(z.array(z.string().min(1).max(160)).max(20).optional());

const variantPropertyValueSchema = z.union([
  z.string().trim().min(1).max(80).transform((label) => ({ id: slugify(label), label })),
  z.object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(80),
  }).strict(),
]);

export const variantPropertySchema = z.object({
  id: identifierSchema.optional(),
  name: z.string().trim().min(1).max(80),
  values: z.array(variantPropertyValueSchema).min(1).max(50),
}).strict().transform((property) => ({
  id: property.id ?? slugify(property.name),
  name: property.name,
  values: property.values,
}));

export const variantCombinationSchema = z.object({
  attributes: z.record(z.string(), z.string()).optional(),
  id: identifierSchema.optional(),
  name: z.string().trim().min(1).max(200),
  sku: identifierSchema,
  stock: z.union([z.number().int().nonnegative(), z.literal(CATALOG_STOCK_MODE.INFINITE)]),
}).strict();

const productBaseSchema = z.object({
  brand: optionalTextSchema,
  categoryIds: z.array(identifierSchema).min(1).max(50).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: "categoryIds must not contain duplicates." },
  ),
  compareAtPrice: optionalMoneySchema,
  description: z.string().trim().min(10).max(10_000),
  heightCm: optionalPositiveIntegerSchema,
  highlightSections: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  isBestSeller: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  lengthCm: optionalPositiveIntegerSchema,
  name: z.string().trim().min(3).max(240),
  promotionalPrice: optionalMoneySchema,
  publicSlug: optionalSlugSchema,
  price: moneySchema,
  seoDescription: z.string().trim().max(160).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  shippingRequired: z.boolean().default(true),
  slug: optionalSlugSchema,
  subcategorySlugs: z.array(identifierSchema).max(50).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  variantCombinations: z.array(variantCombinationSchema).max(2_500).default([]),
  variantProperties: z.array(variantPropertySchema).max(2).default([]),
  visibility: z.enum(catalogVisibilityValues),
  weightGrams: optionalPositiveIntegerSchema,
  widthCm: optionalPositiveIntegerSchema,
}).strict().superRefine((input, context) => {
  if (input.promotionalPrice !== undefined && input.promotionalPrice >= input.price) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "promotionalPrice must be lower than salePrice.",
      path: ["promotionalPrice"],
    });
  }


  const propertyIds = input.variantProperties.map((property) => property.id.toLocaleLowerCase());
  if (new Set(propertyIds).size !== propertyIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "variant property names must be unique.",
      path: ["variantProperties"],
    });
  }

  for (const [index, property] of input.variantProperties.entries()) {
    const valueIds = property.values.map((value) => value.id.toLocaleLowerCase());
    if (new Set(valueIds).size !== valueIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "variant property values must be unique.",
        path: ["variantProperties", index, "values"],
      });
    }
  }
});

export const productCreateSchema = productBaseSchema;
export const productUpdateSchema = productBaseSchema.extend({ id: identifierSchema }).strict();
export const productDuplicateSchema = z.object({ id: identifierSchema }).strict();

export const categoryCreateSchema = z.object({
  description: z.string().trim().max(140).optional(),
  googleShoppingCategory: z.string().trim().max(300).optional(),
  imageUrl: z.url().optional(),
  name: z.string().trim().min(2).max(160),
  parentId: identifierSchema.optional(),
  seoDescription: z.string().trim().max(160).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  slug: optionalSlugSchema,
  visibility: z.enum(catalogVisibilityValues),
}).strict();

export const categoryUpdateSchema = categoryCreateSchema.extend({ id: identifierSchema }).strict();

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict();

const catalogAdminProductSortValues = Object.values(CATALOG_ADMIN_PRODUCT_SORT) as [
  (typeof CATALOG_ADMIN_PRODUCT_SORT)[keyof typeof CATALOG_ADMIN_PRODUCT_SORT],
  ...(typeof CATALOG_ADMIN_PRODUCT_SORT)[keyof typeof CATALOG_ADMIN_PRODUCT_SORT][],
];
const catalogPublicProductSortValues = Object.values(CATALOG_PUBLIC_PRODUCT_SORT) as [
  (typeof CATALOG_PUBLIC_PRODUCT_SORT)[keyof typeof CATALOG_PUBLIC_PRODUCT_SORT],
  ...(typeof CATALOG_PUBLIC_PRODUCT_SORT)[keyof typeof CATALOG_PUBLIC_PRODUCT_SORT][],
];

export const adminProductListQuerySchema = paginationSchema.extend({
  categoryId: identifierSchema.optional(),
  search: z.string().trim().min(1).max(240).optional(),
  sort: z.enum(catalogAdminProductSortValues).default(CATALOG_ADMIN_PRODUCT_SORT.MANUAL_ORDER),
  visibility: z.enum(catalogVisibilityValues).optional(),
}).strict();

export const publicProductListQuerySchema = paginationSchema.extend({
  brandSlug: optionalSlugSchema,
  brandSlugs: csvSlugSchema,
  categorySlug: optionalSlugSchema,
  categorySlugs: csvSlugSchema,
  maxPrice: z.coerce.number().finite().nonnegative().optional(),
  minPrice: z.coerce.number().finite().nonnegative().optional(),
  offersOnly: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  search: z.string().trim().min(1).max(240).optional(),
  subcategorySlugs: csvSlugSchema,
  sort: z.enum(catalogPublicProductSortValues).default(CATALOG_PUBLIC_PRODUCT_SORT.FEATURED),
}).strict().superRefine((query, context) => {
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "minPrice must not exceed maxPrice.", path: ["minPrice"] });
  }
});

export const categoryOrderSchema = z.object({
  categoryIds: z.array(identifierSchema).min(1).max(500),
}).strict();

export const categoryVisibilitySchema = z.object({
  visibility: z.enum(catalogVisibilityValues),
}).strict();

export const catalogSettingsUpdateSchema = z.object({
  showOutOfStockAtEnd: z.boolean(),
}).strict();

export const productPriceUpdateSchema = z.object({
  compareAtPrice: optionalMoneySchema,
  promotionalPrice: optionalMoneySchema,
  price: moneySchema,
}).strict().superRefine((input, context) => {
  if (input.promotionalPrice !== undefined && input.promotionalPrice >= input.price) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "promotionalPrice must be lower than salePrice.",
      path: ["promotionalPrice"],
    });
  }
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
export type CatalogSettingsUpdateInput = z.infer<typeof catalogSettingsUpdateSchema>;
export type CategoryOrderInput = z.infer<typeof categoryOrderSchema>;
export type CategoryVisibilityInput = z.infer<typeof categoryVisibilitySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPriceUpdateInput = z.infer<typeof productPriceUpdateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type PublicProductListQuery = z.infer<typeof publicProductListQuerySchema>;
export type VariantCombinationInput = z.infer<typeof variantCombinationSchema>;
export type VariantPropertyInput = z.infer<typeof variantPropertySchema>;

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "catalog-item";
}
