import { z } from "zod";

const priceTextSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d{1,2})?$/, "Ingresá un número válido")
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => value > 0, "El precio debe ser mayor a 0");

const promotionalPriceTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(
    z
      .union([
        z.undefined(),
        z
          .string()
          .regex(/^\d+(?:[.,]\d{1,2})?$/, "Ingresá un número válido")
          .transform((value) => Number(value.replace(",", ".")))
          .refine((value) => value > 0, "El promocional debe ser mayor a 0"),
      ]),
  );

export const inlineProductPriceSchema = z
  .object({
    salePrice: priceTextSchema,
    promotionalPrice: promotionalPriceTextSchema,
  })
  .refine(
    (value) => value.promotionalPrice === undefined || value.promotionalPrice < value.salePrice,
    {
      message: "El promocional debe ser menor al precio",
      path: ["promotionalPrice"],
    },
  );

export type InlineProductPriceInput = z.input<typeof inlineProductPriceSchema>;
export type InlineProductPrice = z.output<typeof inlineProductPriceSchema>;

const optionalTextSchema = z.string().trim().optional().transform((value) => value || undefined);

export const productVariantPropertySchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre de la propiedad"),
  values: z.array(z.string().trim().min(1)).min(1, "Agregá al menos un valor"),
});

export const productVariantCombinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  stock: z.union([z.number(), z.literal("infinite")]),
  price: z.number().optional(),
});

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(3, "Ingresá al menos 3 caracteres"),
    slug: optionalTextSchema,
    sku: optionalTextSchema,
    categoryId: z.string().trim().min(1, "Seleccioná una categoría"),
    description: z.string().trim().min(10, "Agregá una descripción más completa"),
    imageUrl: optionalTextSchema,
    salePrice: priceTextSchema,
    promotionalPrice: promotionalPriceTextSchema,
    stockMode: z.enum(["limited", "infinite"]),
    stockQuantity: z.string().trim().optional().transform((value) => (value ? Number(value) : undefined)),
    visibility: z.enum(["visible", "hidden"]),
    brand: optionalTextSchema,
    tags: optionalTextSchema,
    seoTitle: z.string().trim().max(70, "El título SEO no puede superar 70 caracteres").optional().transform((value) => value || undefined),
    seoDescription: z.string().trim().max(160, "La descripción SEO no puede superar 160 caracteres").optional().transform((value) => value || undefined),
    highlightSections: z.array(z.string()).default([]),
    variantProperties: z
      .array(productVariantPropertySchema)
      .max(2, "Solo se permiten una Variante y una Subvariante")
      .refine((properties) => new Set(properties.map((property) => property.name.trim().toLowerCase())).size === properties.length, "No se permiten variantes duplicadas")
      .default([]),
    variantCombinations: z.array(productVariantCombinationSchema).default([]),
  })
  .refine(
    (value) => value.promotionalPrice === undefined || value.promotionalPrice < value.salePrice,
    { message: "El promocional debe ser menor al precio", path: ["promotionalPrice"] },
  )
  .refine(
    (value) => value.stockMode === "infinite" || (typeof value.stockQuantity === "number" && Number.isInteger(value.stockQuantity) && value.stockQuantity >= 0),
    { message: "Ingresá stock válido", path: ["stockQuantity"] },
  );

export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductCreateValues = z.output<typeof productCreateSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresá al menos 2 caracteres"),
  slug: optionalTextSchema,
  description: z.string().trim().max(140, "La descripción no puede superar 140 caracteres").optional().transform((value) => value || undefined),
  imageUrl: optionalTextSchema,
  googleShoppingCategory: optionalTextSchema,
  seoTitle: z.string().trim().max(70, "El título SEO no puede superar 70 caracteres").optional().transform((value) => value || undefined),
  seoDescription: z.string().trim().max(160, "La descripción SEO no puede superar 160 caracteres").optional().transform((value) => value || undefined),
  visibility: z.enum(["visible", "hidden"]),
  parentId: optionalTextSchema,
});

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
