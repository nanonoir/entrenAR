import { z } from "zod";

const optionalPositiveNumber = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : Number(value.replace(",", "."))))
  .refine((value) => value === undefined || (Number.isFinite(value) && value > 0), "Ingresá un número mayor a 0");

const requiredPositiveNumber = z
  .string()
  .trim()
  .min(1, "Completá este campo")
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value > 0, "Ingresá un número mayor a 0");

const requiredText = z.string().trim().min(1, "Completá este campo");

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function hasOverlaps(ranges: Array<{ minGrams: number; maxGrams: number }>) {
  return [...ranges].sort((a, b) => a.minGrams - b.minGrams).some((range, index, sorted) => {
    const next = sorted[index + 1];
    return next ? range.maxGrams >= next.minGrams : false;
  });
}

function hasScheduleOverlaps(ranges: Array<{ day: string; from: string; to: string }>) {
  const byDay = new Map<string, Array<{ from: string; to: string }>>();
  ranges.forEach((range) => byDay.set(range.day, [...(byDay.get(range.day) ?? []), range]));
  return Array.from(byDay.values()).some((dayRanges) => [...dayRanges].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from)).some((range, index, sorted) => {
    const next = sorted[index + 1];
    return next ? timeToMinutes(range.to) > timeToMinutes(next.from) : false;
  }));
}

export const providerFormSchema = z.object({
  id: z.enum(["andreani", "correo-argentino"]),
  name: requiredText,
  status: z.enum(["not_configured", "configured_inactive", "active"]),
  enabledModalities: z.array(z.enum(["home_delivery", "branch_delivery"])),
  origin: z.object({
    senderName: requiredText,
    phone: requiredText,
    email: requiredText.email("Ingresá un email válido"),
    street: requiredText,
    number: requiredText,
    city: requiredText,
    province: requiredText,
    postalCode: requiredText,
  }),
  weightRanges: z.array(z.object({
    id: z.string(),
    minGrams: requiredPositiveNumber,
    maxGrams: requiredPositiveNumber,
    cost: requiredPositiveNumber,
  })).min(1, "Agregá al menos un rango"),
  freeShippingThreshold: optionalPositiveNumber,
}).superRefine((value, ctx) => {
  if (value.status === "active" && value.enabledModalities.length === 0) {
    ctx.addIssue({ code: "custom", path: ["enabledModalities"], message: "Seleccioná al menos una modalidad" });
  }
  value.weightRanges.forEach((range, index) => {
    if (range.maxGrams <= range.minGrams) ctx.addIssue({ code: "custom", path: ["weightRanges", index, "maxGrams"], message: "El máximo debe superar al mínimo" });
  });
  if (hasOverlaps(value.weightRanges)) ctx.addIssue({ code: "custom", path: ["weightRanges"], message: "Los rangos de peso no pueden superponerse." });
});

export const pickupPointFormSchema = z.object({
  id: z.string(),
  name: requiredText,
  status: z.enum(["not_configured", "configured_inactive", "active"]),
  isMain: z.boolean(),
  address: z.object({ street: requiredText, number: requiredText, city: requiredText, province: requiredText, postalCode: requiredText }),
  contactName: z.string().trim().optional().transform((value) => value || undefined),
  contactPhone: z.string().trim().optional().transform((value) => value || undefined),
  schedule: z.array(z.object({ id: z.string(), day: requiredText, from: requiredText, to: requiredText })).min(1, "Agregá al menos una franja"),
  preparationHours: requiredPositiveNumber,
  costType: z.enum(["free", "fixed"]),
  fixedCost: optionalPositiveNumber,
  coverageType: z.enum(["all", "provinces"]),
  provinces: z.array(z.string()),
}).superRefine((value, ctx) => {
  value.schedule.forEach((range, index) => {
    if (timeToMinutes(range.to) <= timeToMinutes(range.from)) ctx.addIssue({ code: "custom", path: ["schedule", index, "to"], message: "La hora de cierre debe ser posterior." });
  });
  if (hasScheduleOverlaps(value.schedule)) ctx.addIssue({ code: "custom", path: ["schedule"], message: "Las franjas horarias no pueden superponerse." });
  if (value.costType === "fixed" && !value.fixedCost) ctx.addIssue({ code: "custom", path: ["fixedCost"], message: "Ingresá el costo de retiro" });
  if (value.coverageType === "provinces" && value.provinces.length === 0) ctx.addIssue({ code: "custom", path: ["provinces"], message: "Seleccioná al menos una provincia" });
});

export type ProviderFormInput = z.input<typeof providerFormSchema>;
export type ProviderFormValues = z.output<typeof providerFormSchema>;
export type PickupPointFormInput = z.input<typeof pickupPointFormSchema>;
export type PickupPointFormValues = z.output<typeof pickupPointFormSchema>;
