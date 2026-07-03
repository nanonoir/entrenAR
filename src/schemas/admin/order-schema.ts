import { z } from "zod";
import { adminOptionalText, adminPrimitives, emptyStringToUndefined } from "@/schemas/admin/shared";

const optionalText = adminOptionalText;

const nameField = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres")
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/, "Sólo se permiten letras, espacios, apóstrofes y guiones");

const moneyField = adminPrimitives.price;
const optionalMoneyField = z.preprocess(emptyStringToUndefined, adminPrimitives.price.optional());

export const saleProductLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().min(1, "La cantidad mínima es 1"),
  unitPrice: moneyField,
});

export const orderFormSchema = z
  .object({
    firstName: nameField,
    lastName: nameField,
    email: optionalText.refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "El e-mail no es válido",
    }),
    phone: optionalText.refine((val) => !val || /^\+?[0-9\s\-()]{7,24}$/.test(val), {
      message: "El teléfono no es válido",
    }),
    dniOrCuil: optionalText.refine((val) => !val || /^\d{7,11}$/.test(val), {
      message: "El DNI/CUIL debe tener entre 7 y 11 dígitos",
    }),

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

    products: z.array(saleProductLineSchema).min(1, "Agregá al menos un producto"),

    paymentOption: z.enum(["unpaid", "pending", "received"], "Seleccioná una opción de pago"),

    source: optionalText,

    discountType: z.preprocess(
      (val) => (val === "" || val === null ? undefined : val),
      z.enum(["percentage", "fixed"]).optional(),
    ),
    discountValue: optionalMoneyField,

    shippingCost: moneyField.default(0),

    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const subtotal = data.products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0);

    if (data.discountType === "percentage" && data.discountValue !== undefined && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "El descuento en porcentaje no puede superar el 100%",
      });
    }

    if (data.discountType === "fixed" && data.discountValue !== undefined && data.discountValue > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "El descuento no puede superar el subtotal",
      });
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
export type OrderFormInput = z.input<typeof orderFormSchema>;
