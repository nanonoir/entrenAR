import { z } from "zod";

import { CATALOG_STOCK_MODE, CATALOG_VISIBILITY } from "./catalog.constants";

const catalogVisibilityValues = Object.values(CATALOG_VISIBILITY) as [
  (typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY],
  ...(typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY][],
];
const catalogStockModeValues = Object.values(CATALOG_STOCK_MODE) as [
  (typeof CATALOG_STOCK_MODE)[keyof typeof CATALOG_STOCK_MODE],
  ...(typeof CATALOG_STOCK_MODE)[keyof typeof CATALOG_STOCK_MODE][],
];

const identifierSchema = z.string().trim().min(1).max(128);
const optionalTextSchema = z.string().trim().min(1).max(500).optional();
const optionalSlugSchema = z.string().trim().min(1).max(160).optional();
const moneySchema = z.number().finite().positive().multipleOf(0.01);
const optionalMoneySchema = moneySchema.optional();
const optionalPositiveIntegerSchema = z.number().int().positive().optional();

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
  compareAtPrice: optionalMoneySchema,
  id: identifierSchema.optional(),
  name: z.string().trim().min(1).max(200),
  price: optionalMoneySchema,
  sku: optionalSlugSchema,
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
  imageTone: z.string().trim().min(1).max(32).optional(),
  imageUrl: z.url().optional(),
  isBestSeller: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  lengthCm: optionalPositiveIntegerSchema,
  name: z.string().trim().min(3).max(240),
  promotionalPrice: optionalMoneySchema,
  publicSlug: optionalSlugSchema,
  salePrice: moneySchema,
  seoDescription: z.string().trim().max(160).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  shippingRequired: z.boolean().default(true),
  sku: optionalSlugSchema,
  slug: optionalSlugSchema,
  stockMode: z.enum(catalogStockModeValues),
  stockQuantity: z.number().int().nonnegative().optional(),
  subcategorySlugs: z.array(identifierSchema).max(50).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  variantCombinations: z.array(variantCombinationSchema).max(2_500).default([]),
  variantProperties: z.array(variantPropertySchema).max(2).default([]),
  visibility: z.enum(catalogVisibilityValues),
  weightGrams: optionalPositiveIntegerSchema,
  widthCm: optionalPositiveIntegerSchema,
}).strict().superRefine((input, context) => {
  if (input.promotionalPrice !== undefined && input.promotionalPrice >= input.salePrice) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "promotionalPrice must be lower than salePrice.",
      path: ["promotionalPrice"],
    });
  }

  if (input.stockMode === CATALOG_STOCK_MODE.LIMITED && input.stockQuantity === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "stockQuantity is required for limited stock.",
      path: ["stockQuantity"],
    });
  }

  if (input.stockMode === CATALOG_STOCK_MODE.INFINITE && input.stockQuantity !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "stockQuantity must be omitted for infinite stock.",
      path: ["stockQuantity"],
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

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
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
