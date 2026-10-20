const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textOnlyPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'.-]+$/;

export function sanitizeTextInput(value: string) {
  return value.replace(/[0-9]/g, "");
}

export const STREET_MAX_LENGTH = 200;
/** Backend `street` limit; `floor` has no checkout contract field and follows the CRM address limit (80). */
export const FLOOR_MAX_LENGTH = 80;
const addressTextDisallowed = /[^\p{L}\p{M}\d\s'.,°ºª/#-]/gu;
const addressTextPattern = /^[\p{L}\p{M}\d\s'.,°ºª/#-]+$/u;

/** Street names legitimately contain digits ("9 de Julio", "Calle 50", "Ruta 2"): only unsafe characters are removed. */
export function sanitizeStreetInput(value: string) {
  return value.replace(addressTextDisallowed, "").slice(0, STREET_MAX_LENGTH);
}

export function sanitizeFloorInput(value: string) {
  return value.replace(addressTextDisallowed, "").slice(0, FLOOR_MAX_LENGTH);
}

/** Matches the backend checkout `neighborhood` limit (same as the CRM address). */
export const NEIGHBORHOOD_MAX_LENGTH = 120;

/** Neighborhoods are alphanumeric ("Barrio 31", "1-11-14"): digits are kept, unsafe characters removed. */
export function sanitizeNeighborhoodInput(value: string) {
  return value.replace(addressTextDisallowed, "").slice(0, NEIGHBORHOOD_MAX_LENGTH);
}

/** Optional field: empty is valid; otherwise bounded safe text. */
export function isValidNeighborhood(value: string) {
  const text = value.trim();
  return text === "" || (text.length <= NEIGHBORHOOD_MAX_LENGTH && addressTextPattern.test(text));
}

export function isValidStreetName(value: string) {
  const text = value.trim();
  return text.length <= STREET_MAX_LENGTH && addressTextPattern.test(text) && /\p{L}/u.test(text);
}

/** Optional field: empty is valid; otherwise bounded text such as "3", "PB", "3° B" or "Dto 4/5". */
export function isValidFloor(value: string) {
  const text = value.trim();
  return text === "" || (text.length <= FLOOR_MAX_LENGTH && addressTextPattern.test(text));
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
