import { z } from "zod";

const couponCodePattern = /^[A-Z0-9-]+$/;

function emptyNumberToUndefined(value: unknown) {
  return typeof value === "number" && Number.isNaN(value) ? undefined : value;
}

const optionalPositiveNumber = z.preprocess(emptyNumberToUndefined, z.number({ error: "Ingresá un valor numérico válido." }).positive("Ingresá un valor mayor a 0.").optional());
const optionalPositiveInteger = z.preprocess(emptyNumberToUndefined, z.number({ error: "Ingresá un número válido." }).int("Ingresá un número entero.").positive("Ingresá un número mayor a 0.").optional());
const requiredNonNegativeNumber = z.preprocess(emptyNumberToUndefined, z.number({ error: "Ingresá un monto válido." }).min(0, "Ingresá un monto válido."));

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase();
}

export const couponSchema = z
  .object({
    code: z.string().trim().min(1, "Ingresá un código para el cupón.").transform(normalizeCouponCode).refine((value) => !/\s/.test(value), "El código no puede contener espacios.").refine((value) => couponCodePattern.test(value), "Usá letras, números o guiones."),
    discountType: z.enum(["percentage", "fixed", "free_shipping"]),
    discountValue: optionalPositiveNumber,
    includeShippingCost: z.boolean(),
    targetType: z.enum(["all_store", "categories", "products"]),
    categoryIds: z.array(z.string()),
    productIds: z.array(z.string()),
    canCombineWithPromotions: z.boolean(),
    totalUsageLimitType: z.enum(["unlimited", "limited"]),
    totalUsageLimit: optionalPositiveInteger,
    customerLimitType: z.enum(["unlimited", "limited", "first_purchase"]),
    customerUsageLimit: optionalPositiveInteger,
    dateLimitType: z.enum(["unlimited", "period"]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    minimumCartAmount: requiredNonNegativeNumber,
    maxDiscountType: z.enum(["none", "amount"]),
    maxDiscountAmount: optionalPositiveNumber,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percentage" && (value.discountValue === undefined || value.discountValue <= 0)) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Ingresá un porcentaje de descuento." });
    if (value.discountType === "percentage" && value.discountValue !== undefined && value.discountValue > 100) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "El porcentaje no puede superar el 100%." });
    if (value.discountType === "fixed" && (value.discountValue === undefined || value.discountValue <= 0)) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Ingresá un monto de descuento." });
    if (value.discountType === "free_shipping" && value.discountValue !== undefined) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "El cupón de envío gratis no usa monto de descuento." });
    if (value.targetType === "categories" && value.categoryIds.length === 0) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Seleccioná al menos una categoría." });
    if (value.targetType === "products" && value.productIds.length === 0) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Seleccioná al menos un producto." });
    if (value.totalUsageLimitType === "limited" && !value.totalUsageLimit) ctx.addIssue({ code: "custom", path: ["totalUsageLimit"], message: "Ingresá cuántas veces podrá usarse el cupón." });
    if (value.customerLimitType === "limited" && !value.customerUsageLimit) ctx.addIssue({ code: "custom", path: ["customerUsageLimit"], message: "Ingresá cuántas veces podrá usarlo cada cliente." });
    if (value.dateLimitType === "period") {
      if (!value.startDate) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Ingresá la fecha de inicio." });
      if (!value.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ingresá la fecha de fin." });
      if (value.startDate && value.endDate && value.endDate < value.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha de fin debe ser posterior o igual al inicio." });
    }
    if (value.maxDiscountType === "amount" && !value.maxDiscountAmount) ctx.addIssue({ code: "custom", path: ["maxDiscountAmount"], message: "Ingresá el tope máximo de descuento." });
  });

export const shippingDiscountSchema = z
  .object({
    shippingMethodIds: z.array(z.string()),
    onlyCheapestShippingMethod: z.boolean(),
    targetType: z.enum(["all_store", "categories"]),
    categoryIds: z.array(z.string()),
    canCombineWithPromotions: z.boolean(),
    zoneTargetType: z.enum(["all", "specific"]),
    zoneIds: z.array(z.string()),
    minimumCartAmount: requiredNonNegativeNumber,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((value, ctx) => {
    if (value.shippingMethodIds.length === 0) ctx.addIssue({ code: "custom", path: ["shippingMethodIds"], message: "Seleccioná al menos un medio de envío." });
    if (value.targetType === "categories" && value.categoryIds.length === 0) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Seleccioná al menos una categoría." });
    if (value.zoneTargetType === "specific" && value.zoneIds.length === 0) ctx.addIssue({ code: "custom", path: ["zoneIds"], message: "Seleccioná al menos una zona de envío." });
  });

export function createCouponSchema(existingCodes: string[] = [], currentCode?: string) {
  const normalizedExistingCodes = existingCodes.map(normalizeCouponCode).filter((code) => code !== (currentCode ? normalizeCouponCode(currentCode) : undefined));
  return couponSchema.refine((value) => !normalizedExistingCodes.includes(value.code), { path: ["code"], message: "Ya existe un cupón con ese código." });
}

export type CouponFormInput = z.input<typeof couponSchema>;
export type CouponFormValues = z.output<typeof couponSchema>;
export type ShippingDiscountFormInput = z.input<typeof shippingDiscountSchema>;
export type ShippingDiscountFormValues = z.output<typeof shippingDiscountSchema>;
