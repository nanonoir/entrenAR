import { z } from "zod";

// Money parsing: accepts "." or "," as decimal separator; returns a number.
function parseMoneyString(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const normalized = val.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

const optionalText = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().optional(),
);

const nameField = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres")
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/, "Sólo se permiten letras, espacios, apóstrofes y guiones");

const moneyField = z
  .union([z.string(), z.number()])
  .transform(parseMoneyString)
  .pipe(z.number({ message: "Ingresá un valor numérico válido" }).min(0, "El valor no puede ser negativo"));

const optionalMoneyField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => (val === "" || val === undefined ? undefined : parseMoneyString(val)))
  .pipe(z.number().min(0, "El valor no puede ser negativo").optional());

export const saleProductLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().min(1, "La cantidad mínima es 1"),
  unitPrice: moneyField,
});

export const orderFormSchema = z
  .object({
    // Customer
    firstName: nameField,
    lastName: nameField,
    email: optionalText
      .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: "El e-mail no es válido",
      }),
    phone: optionalText
      .refine((val) => !val || /^\+?[0-9\s\-()]{7,24}$/.test(val), {
        message: "El teléfono no es válido",
      }),
    dniOrCuil: optionalText
      .refine((val) => !val || /^\d{7,11}$/.test(val), {
        message: "El DNI/CUIL debe tener entre 7 y 11 dígitos",
      }),

    // Shipping address (optional block)
    shippingAddressEnabled: z.boolean().optional().default(false),
    shippingStreet: z.string().optional(),
    shippingNumber: z.string().optional(),
    shippingFloor: z.string().optional(),
    shippingUnit: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingProvince: z.string().optional(),
    shippingPostalCode: z.string().optional(),
    shippingCountry: z.string().optional().default("Argentina"),
    shippingNotes: z.string().optional(),

    // Products — validated separately via products array
    products: z.array(saleProductLineSchema).min(1, "Agregá al menos un producto"),

    // Payment
    paymentOption: z.enum(["unpaid", "pending", "received"], "Seleccioná una opción de pago"),

    // Source
    source: optionalText,

    // Discount
    discountType: z.preprocess(
      (val) => (val === "" || val === null ? undefined : val),
      z.enum(["percentage", "fixed"]).optional(),
    ),
    discountValue: optionalMoneyField,

    // Shipping cost
    shippingCost: moneyField.default(0),

    // Notes
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Subtotal for cross-field validation
    const subtotal = data.products.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

    if (data.discountType === "percentage" && data.discountValue !== undefined) {
      if (data.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountValue"],
          message: "El descuento en porcentaje no puede superar el 100%",
        });
      }
    }
    if (data.discountType === "fixed" && data.discountValue !== undefined) {
      if (data.discountValue > subtotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountValue"],
          message: "El descuento no puede superar el subtotal",
        });
      }
    }

    if (data.shippingAddressEnabled && !data.shippingStreet?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingStreet"],
        message: "Ingresá la calle para la dirección de envío",
      });
    }
  });

export type OrderFormValues = z.infer<typeof orderFormSchema>;

// Derive a raw input type (strings accepted from inputs before Zod transforms them)
export type OrderFormInput = z.input<typeof orderFormSchema>;
