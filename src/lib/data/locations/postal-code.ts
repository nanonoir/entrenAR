import { findVerifiedCp4Correspondence } from "./verified-cp4-correspondences";

/** CPA first letter → Georef province id (ISO 3166-2:AR codes). */
export const CPA_LETTER_PROVINCE_IDS: Readonly<Record<string, string>> = {
  A: "66", B: "06", C: "02", D: "74", E: "30", F: "46", G: "86", H: "22", J: "70", K: "10", L: "42", M: "50",
  N: "54", P: "34", Q: "58", R: "62", S: "82", T: "90", U: "26", V: "94", W: "18", X: "14", Y: "38", Z: "78",
};

const CPA_PATTERN = /^[A-Z]\d{4}[A-Z]{3}$/;
const CP4_PATTERN = /^[1-9]\d{3}$/;

export const POSTAL_CODE_MAX_LENGTH = 8;

export type PostalCodeFormat = "cp4" | "cpa" | "invalid" | "empty";
export type PostalProvinceRecognition = { provinceId: string | null; source: "cpa-letter" | "cp4-table" | null };

/** Keeps only letters/digits, uppercased, max 8 chars (CP4 or CPA). */
export function sanitizePostalCodeInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, POSTAL_CODE_MAX_LENGTH);
}

export function getPostalCodeFormat(value: string): PostalCodeFormat {
  const code = sanitizePostalCodeInput(value);
  if (!code) return "empty";
  if (CP4_PATTERN.test(code)) return "cp4";
  if (CPA_PATTERN.test(code) && CPA_LETTER_PROVINCE_IDS[code[0] ?? ""]) return "cpa";
  return "invalid";
}

/** Province recognition never blocks: CPA letters are deterministic, CP4 only comes from the verified table. */
export function recognizeProvinceFromPostalCode(value: string): PostalProvinceRecognition {
  const code = sanitizePostalCodeInput(value);
  const format = getPostalCodeFormat(code);
  if (format === "cpa") return { provinceId: CPA_LETTER_PROVINCE_IDS[code[0] ?? ""] ?? null, source: "cpa-letter" };
  if (format === "cp4") {
    const verified = findVerifiedCp4Correspondence(code);
    if (verified) return { provinceId: verified.provinceId, source: "cp4-table" };
  }
  return { provinceId: null, source: null };
}

/** Returns an error when the recognized province contradicts the selected one; unknown values never contradict. */
export function getPostalProvinceConflict(value: string, selectedProvinceId: string): string | null {
  if (!selectedProvinceId) return null;
  const recognition = recognizeProvinceFromPostalCode(value);
  if (!recognition.provinceId || recognition.provinceId === selectedProvinceId) return null;
  return "El código postal no coincide con la provincia seleccionada.";
}
