const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textOnlyPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;

export function sanitizeTextInput(value: string) {
  return value.replace(/[0-9]/g, "");
}

export function sanitizeNumericInput(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizePhoneInput(value: string) {
  return value.replace(/[^+\d\s]/g, "");
}

export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function isValidDni(value: string) {
  return /^\d{6,9}$/.test(value);
}

export function isValidPhone(value: string) {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 10 && digits.length <= 13;
}

export function isValidTextOnly(value: string) {
  return textOnlyPattern.test(value.trim());
}

export function isValidNumericOnly(value: string) {
  return /^\d+$/.test(value);
}
