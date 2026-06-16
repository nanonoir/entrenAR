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
