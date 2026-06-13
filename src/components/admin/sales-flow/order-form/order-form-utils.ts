import type { OrderFormInput } from "@/components/admin/sales-flow/OrderFormSchema";
import type { Path, PathValue, UseFormSetValue } from "react-hook-form";

export function parseFormNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeName(value: string): string {
  return value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ' -]/g, "");
}

export function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function sanitizePhone(value: string): string {
  return value.replace(/(?!^)\+/g, "").replace(/[^0-9\s\-()+]/g, "").slice(0, 24);
}

export function sanitizeDecimal(value: string): string {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [integer = "", ...decimals] = normalized.split(".");
  return decimals.length > 0 ? `${integer}.${decimals.join("")}` : integer;
}

export function sanitizeAddress(value: string): string {
  return value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ0-9' .,#°º/-]/g, "");
}

export function getProductErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeError = error as { message?: unknown; root?: { message?: unknown } };

  if (typeof maybeError.message === "string") return maybeError.message;
  if (typeof maybeError.root?.message === "string") return maybeError.root.message;

  return undefined;
}

export function setSanitizedFormValue<TName extends Path<OrderFormInput>>(
  setValue: UseFormSetValue<OrderFormInput>,
  name: TName,
  value: string,
  sanitize: (raw: string) => string,
) {
  setValue(name, sanitize(value) as PathValue<OrderFormInput, TName>, { shouldDirty: true, shouldValidate: true });
}
