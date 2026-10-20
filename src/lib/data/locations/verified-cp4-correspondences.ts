import { CP4_PROVINCE_TABLE, CP4_PROVINCE_TABLE_SOURCE } from "./cp4-province-table.generated";

/**
 * Verified 4-digit postal code → province correspondences (Georef province ids).
 *
 * There is no open, exhaustive CP4 source: Correo Argentino publishes no CP lists and the CP4 scheme has been
 * unmaintained since 1974 (see docs/design-docs/2026-10-19-checkout-inputs-drafts-delivery.md). Coverage comes from:
 *  1. the GeoNames Argentina postal dump (CC BY 4.0), keeping only CP4 values whose every entry sits in one province;
 *  2. explicit entries below with their own provenance.
 * Anything else (including multi-province CP4 values) is "unknown": the shopper picks the province manually and the
 * value never blocks checkout. Never invent ranges here.
 */
export type VerifiedCp4Correspondence = {
  readonly provinceId: string;
  /** Where the correspondence was verified. */
  readonly provenance: string;
};

const EXPLICIT_CP4_CORRESPONDENCES: Readonly<Record<string, VerifiedCp4Correspondence>> = {
  "1406": { provenance: "Pre-existing checkout fixture (Caballito); CP 1406 belongs to the Ciudad Autónoma de Buenos Aires. CABA is absent from GeoNames.", provinceId: "02" },
};

export function findVerifiedCp4Correspondence(code: string): VerifiedCp4Correspondence | undefined {
  const explicit = EXPLICIT_CP4_CORRESPONDENCES[code];
  if (explicit) return explicit;
  const provinceId = Object.hasOwn(CP4_PROVINCE_TABLE, code) ? CP4_PROVINCE_TABLE[code] : undefined;
  return provinceId ? { provenance: CP4_PROVINCE_TABLE_SOURCE, provinceId } : undefined;
}
