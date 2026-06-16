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

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(3, "Ingresá al menos 3 caracteres"),
    slug: optionalTextSchema,
    sku: z.string().trim().min(3, "Ingresá un SKU válido"),
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
    shippingRequired: z.boolean(),
    missingLogistics: z.boolean(),
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
