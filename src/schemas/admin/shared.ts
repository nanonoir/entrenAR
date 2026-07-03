import { z } from "zod";

const decimalTextPattern = /^-?\d+(?:[,.]\d+)?$/;
const codePattern = /^[A-Z0-9_-]+$/;

export function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function normalizeNumericInput(value: unknown) {
  const normalized = emptyStringToUndefined(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === "number") return Number.isFinite(normalized) ? normalized : Number.NaN;
  if (typeof normalized !== "string") return Number.NaN;

  const trimmed = normalized.trim().replace(",", ".");
  if (!decimalTextPattern.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export const adminOptionalText = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().optional(),
);

export const adminPrimitives = {
  price: z.preprocess(
    normalizeNumericInput,
    z.number({ error: "Ingresá un valor numérico válido" })
      .refine(Number.isFinite, "Ingresá un valor numérico válido")
      .min(0, "El valor no puede ser negativo"),
  ),
  percentage: z.preprocess(
    normalizeNumericInput,
    z.number({ error: "Ingresá un porcentaje válido" })
      .refine(Number.isFinite, "Ingresá un porcentaje válido")
      .min(0, "El porcentaje no puede ser negativo")
      .max(100, "El porcentaje no puede superar el 100%"),
  ),
  stock: z.preprocess(
    normalizeNumericInput,
    z.number({ error: "Ingresá un stock válido" })
      .refine(Number.isFinite, "Ingresá un stock válido")
      .int("El stock debe ser un número entero")
      .min(0, "El stock no puede ser negativo"),
  ),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(codePattern, "Usá letras, números, guiones o guiones bajos"),
};
