import type { AccountAddressInput, AccountProfileUpdate } from "@/types/account";

export const ACCOUNT_PASSWORD_MIN_LENGTH = 12;

export const passwordRules = [
  { label: `${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres mínimo`, test: (value: string) => value.length >= ACCOUNT_PASSWORD_MIN_LENGTH },
  { label: "Una mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Una minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un número", test: (value: string) => /\d/.test(value) },
  { label: "Un carácter especial", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const phonePattern = /^\+?[0-9\s\-()]+$/;
const postalCodePattern = /^[A-Za-z0-9][A-Za-z0-9 -]*$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAccountEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidPassword(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value.trim());
}

export function isValidAccountProfile(value: AccountProfileUpdate): boolean {
  return (
    isValidName(value.firstName) &&
    isValidName(value.lastName) &&
    /^\d{6,9}$/.test(value.dni.trim()) &&
    isNonEmptyText(value.gender, 40) &&
    isValidIsoDate(value.birthDate) &&
    isValidPhone(value.phone)
  );
}

export function isValidAccountAddress(value: AccountAddressInput): boolean {
  return (
    isNonEmptyText(value.label, 60) &&
    isNonEmptyText(value.recipient, 120) &&
    isNonEmptyText(value.street, 200) &&
    isNonEmptyText(value.city, 120) &&
    isNonEmptyText(value.province, 120) &&
    isValidPostalCode(value.postalCode) &&
    isValidPhone(value.phone)
  );
}

function isValidName(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 120 && namePattern.test(normalized);
}

function isNonEmptyText(value: string, maxLength: number): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength;
}

function isValidPhone(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 7 && normalized.length <= 24 && phonePattern.test(normalized);
}

function isValidPostalCode(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 20 && postalCodePattern.test(normalized);
}

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
