import { z } from "zod";

export const DEFAULT_WEIGHT_RANGES = [
  { id: "range-up-to-1kg", minGrams: 0, maxGrams: 1000, cost: 7500 },
  { id: "range-1kg-to-3kg", minGrams: 1000, maxGrams: 3000, cost: 10500 },
  { id: "range-3kg-to-5kg", minGrams: 3000, maxGrams: 5000, cost: 15000 },
  { id: "range-5kg-to-10kg", minGrams: 5000, maxGrams: 10000, cost: 22000 },
  { id: "range-over-10kg", minGrams: 10000, maxGrams: 999999, cost: 30000 },
] as const;

const nameLikePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
const streetPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9' .-]+$/;
const phonePattern = /^\+?[0-9 ()-]+$/;
const postalCodePattern = /^[A-Za-z0-9 -]+$/;

export function normalizeNameLike(value: string) {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "").replace(/\s+/g, " ");
}

export function normalizeStreetLike(value: string) {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9' .-]/g, "").replace(/\s+/g, " ");
}

export function normalizeDigitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePostalCode(value: string) {
  return value.replace(/[^A-Za-z0-9 -]/g, "").replace(/\s+/g, " ").toUpperCase();
}

export function normalizePhone(value: string) {
  return value.replace(/[^0-9 ()+-]/g, "").replace(/\s+/g, " ");
}

export function normalizeDecimalInput(value: string) {
  const normalized = value.replace(/[^0-9,.]/g, "").replace(/,/g, ".");
  const [integer = "", ...decimalParts] = normalized.split(".");
  return decimalParts.length ? `${integer}.${decimalParts.join("")}` : integer;
}

const requiredNameLike = (message = "Completá este campo") => z.string().trim().min(1, message).regex(nameLikePattern, "Usá solo letras, espacios, apóstrofes o guiones");
const optionalNameLike = z.string().trim().optional().transform((value) => value || undefined).refine((value) => value === undefined || nameLikePattern.test(value), "Usá solo letras, espacios, apóstrofes o guiones");
const requiredStreetLike = z.string().trim().min(1, "Completá este campo").regex(streetPattern, "Usá letras, números, espacios, puntos o guiones");
const requiredDigits = z.string().trim().min(1, "Completá este campo").regex(/^\d+$/, "Usá solo números");
const requiredPostalCode = z.string().trim().min(1, "Completá este campo").regex(postalCodePattern, "Usá letras, números, espacios o guiones");
const requiredPhone = z.string().trim().min(1, "Completá este campo").regex(phonePattern, "Ingresá un teléfono válido");
const optionalPhone = z.string().trim().optional().transform((value) => value || undefined).refine((value) => value === undefined || phonePattern.test(value), "Ingresá un teléfono válido");

const optionalPositiveNumber = z
  .string()
  .trim()
  .regex(/^$|^\d+(?:[,.]\d+)?$/, "Ingresá solo números")
  .transform((value) => (value === "" ? undefined : Number(value.replace(",", "."))))
  .refine((value) => value === undefined || (Number.isFinite(value) && value > 0), "Ingresá un número mayor a 0");

const requiredPositiveNumber = z
  .string()
  .trim()
  .min(1, "Completá este campo")
  .regex(/^\d+(?:[,.]\d+)?$/, "Ingresá solo números")
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value > 0, "Ingresá un número mayor a 0");

const requiredNonNegativeNumber = z
  .string()
  .trim()
  .min(1, "Completá este campo")
  .regex(/^\d+(?:[,.]\d+)?$/, "Ingresá solo números")
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0, "Ingresá un número igual o mayor a 0");

const requiredText = z.string().trim().min(1, "Completá este campo");

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function hasOverlaps(ranges: Array<{ minGrams: number; maxGrams: number }>) {
  return [...ranges].sort((a, b) => a.minGrams - b.minGrams).some((range, index, sorted) => {
    const next = sorted[index + 1];
    return next ? range.maxGrams > next.minGrams : false;
  });
}

function findScheduleOverlap(ranges: Array<{ day: string; from: string; to: string }>) {
  const byDay = new Map<string, Array<{ from: string; to: string; index: number }>>();
  ranges.forEach((range, index) => byDay.set(range.day, [...(byDay.get(range.day) ?? []), { ...range, index }]));
  for (const [day, dayRanges] of byDay.entries()) {
    const sorted = [...dayRanges].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const range = sorted[index];
      const next = sorted[index + 1];
      if (timeToMinutes(range.to) > timeToMinutes(next.from)) return { day, index: next.index };
    }
  }
  return null;
}

export const providerFormSchema = z.object({
  id: z.enum(["andreani", "correo-argentino"]),
  name: requiredNameLike(),
  status: z.enum(["not_configured", "configured_inactive", "active"]),
  enabledModalities: z.array(z.enum(["home_delivery", "branch_delivery"])),
  origin: z.object({
    senderName: requiredNameLike(),
    phone: requiredPhone,
    email: requiredText.email("Ingresá un email válido"),
    street: requiredStreetLike,
    number: requiredDigits,
    city: requiredNameLike(),
    province: requiredNameLike(),
    postalCode: requiredPostalCode,
  }),
  weightRanges: z.array(z.object({
    id: z.string(),
    minGrams: requiredNonNegativeNumber,
    maxGrams: requiredPositiveNumber,
    cost: requiredNonNegativeNumber,
  })).length(DEFAULT_WEIGHT_RANGES.length, "Los rangos de peso deben mantenerse completos"),
  freeShippingThreshold: optionalPositiveNumber,
}).superRefine((value, ctx) => {
  if (value.status === "active" && value.enabledModalities.length === 0) {
    ctx.addIssue({ code: "custom", path: ["enabledModalities"], message: "Seleccioná al menos una modalidad" });
  }
  value.weightRanges.forEach((range, index) => {
    if (range.maxGrams <= range.minGrams) ctx.addIssue({ code: "custom", path: ["weightRanges", index, "maxGrams"], message: "El máximo debe superar al mínimo" });
    const expected = DEFAULT_WEIGHT_RANGES[index];
    if (expected && (range.minGrams !== expected.minGrams || range.maxGrams !== expected.maxGrams)) ctx.addIssue({ code: "custom", path: ["weightRanges", index], message: "Los límites del rango no se editan en esta versión" });
  });
  if (hasOverlaps(value.weightRanges)) ctx.addIssue({ code: "custom", path: ["weightRanges"], message: "Los rangos de peso no pueden superponerse." });
});

export const pickupPointFormSchema = z.object({
  id: z.string(),
  name: requiredNameLike(),
  status: z.enum(["not_configured", "configured_inactive", "active"]),
  isMain: z.boolean(),
  address: z.object({ street: requiredStreetLike, number: requiredDigits, city: requiredNameLike(), province: requiredNameLike(), postalCode: requiredPostalCode }),
  contactName: optionalNameLike,
  contactPhone: optionalPhone,
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
  const overlap = findScheduleOverlap(value.schedule);
  if (overlap) {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: `Las franjas de ${overlap.day} no pueden superponerse.` });
    ctx.addIssue({ code: "custom", path: ["schedule", overlap.index, "from"], message: "Esta franja se superpone con otra del mismo día." });
  }
  if (value.costType === "fixed" && !value.fixedCost) ctx.addIssue({ code: "custom", path: ["fixedCost"], message: "Ingresá el costo de retiro" });
  if (value.coverageType === "provinces" && value.provinces.length === 0) ctx.addIssue({ code: "custom", path: ["provinces"], message: "Seleccioná al menos una provincia" });
});

export type ProviderFormInput = z.input<typeof providerFormSchema>;
export type ProviderFormValues = z.output<typeof providerFormSchema>;
export type PickupPointFormInput = z.input<typeof pickupPointFormSchema>;
export type PickupPointFormValues = z.output<typeof pickupPointFormSchema>;
