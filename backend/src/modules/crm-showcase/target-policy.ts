import { identifyDatabaseTarget, type DatabaseTargetIdentity } from "../catalog-scraper/operations/database-target";

export interface ShowcaseAuthorization {
  purpose: string;
  destinationFingerprint: string;
  source: DatabaseTargetIdentity;
  baselineDumpSha256: string;
  baselineDigest: string;
  schedulerDisabled: boolean;
  schedulerEvidence: string;
  sourcePersonalDataAbsent: boolean;
  separateInstance: boolean;
  serverAddress: string;
  trustedOwner?: boolean;
  restoreEvidence?: ShowcaseRestoreEvidence;
}

export interface ShowcaseRestoreEvidence {
  destination: DatabaseTargetIdentity;
  dumpSha256: string;
  restoredBaselineDigest: string;
  sourceBaselineDigest: string;
  verified: boolean;
  description: string;
}

export const TRUSTED_LOCAL_FINGERPRINT = "83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a";

export interface AuthorizedTarget {
  identity: DatabaseTargetIdentity;
  authorization: ShowcaseAuthorization;
}

export function authorizeTarget(connectionString: string | undefined, manifest: unknown, runtime: string | undefined): AuthorizedTarget {
  if (!connectionString || runtime?.trim().toLowerCase() === "production") throw new Error("Showcase destination is not authorized.");
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error("Showcase destination configuration is invalid."); }
  for (const key of url.searchParams.keys()) {
    if (key !== "schema") throw new Error("Showcase connection overrides are forbidden.");
  }
  if (url.hash || !url.username || !url.password || url.searchParams.getAll("schema").length > 1) {
    throw new Error("Showcase destination configuration is incomplete or ambiguous.");
  }
  const identity = identifyDatabaseTarget(connectionString);
  const trustedLocal = isRecord(manifest) && manifest.purpose === "crm-showcase-trusted-owner-local";
  if (trustedLocal) {
    if (identity.host !== "127.0.0.1" || identity.port !== 5432 || identity.database !== "entrenar" || identity.schema !== "public" || identity.fingerprint !== TRUSTED_LOCAL_FINGERPRINT) {
      throw new Error("Trusted-owner authorization is restricted to the exact approved local destination.");
    }
    assertTrustedOwnerEvidence(manifest);
    if (manifest.destinationFingerprint !== identity.fingerprint || !isHash(manifest.baselineDigest) || manifest.schedulerDisabled !== true || typeof manifest.schedulerEvidence !== "string" || !manifest.schedulerEvidence.trim() || typeof manifest.serverAddress !== "string" || !manifest.serverAddress.trim()) {
      throw new Error("Trusted-owner local authorization is incomplete.");
    }
    return { identity, authorization: manifest as unknown as ShowcaseAuthorization };
  }
  if (!["127.0.0.1", "::1"].includes(identity.host) || identity.schema !== "public" || !/^entrenar_crm_demo_[a-z0-9_]+$/.test(identity.database)) {
    throw new Error("Showcase requires a literal loopback demo destination in public schema.");
  }
  if (!isRecord(manifest) || !isRecord(manifest.source)) throw new Error("Showcase authorization is incomplete.");
  const source = manifest.source;
  if (typeof source.host !== "string" || typeof source.port !== "number" || !Number.isInteger(source.port) || source.port < 1 || source.port > 65535 || typeof source.database !== "string" || !source.database || source.schema !== "public" || !isHash(source.fingerprint) || source.hostAddress !== undefined && typeof source.hostAddress !== "string") {
    throw new Error("Showcase source identity is incomplete.");
  }
  const sourceHost = source.host.includes(":") ? `[${source.host}]` : source.host;
  const sourceAddress = source.hostAddress === undefined ? "" : `&hostaddr=${encodeURIComponent(source.hostAddress as string)}`;
  const canonicalSource = identifyDatabaseTarget(`postgresql://${sourceHost}:${source.port}/${encodeURIComponent(source.database)}?schema=public${sourceAddress}`);
  if (canonicalSource.fingerprint !== source.fingerprint) throw new Error("Showcase source identity fingerprint is inconsistent.");
  if (manifest.purpose !== "crm-showcase-demo" || manifest.destinationFingerprint !== identity.fingerprint ||
      !isHash(manifest.baselineDumpSha256) || !isHash(manifest.baselineDigest) ||
      manifest.schedulerDisabled !== true || typeof manifest.schedulerEvidence !== "string" || !manifest.schedulerEvidence.trim() ||
      (manifest.trustedOwner === true ? false : manifest.sourcePersonalDataAbsent !== true) || manifest.separateInstance !== true ||
      typeof manifest.serverAddress !== "string" || !manifest.serverAddress.trim() ||
      source.fingerprint === identity.fingerprint || source.database === identity.database || source.port === identity.port) {
    throw new Error("Showcase isolation or baseline authorization is invalid.");
  }
  if (manifest.trustedOwner === true) assertTrustedOwnerEvidence(manifest);
  return { identity, authorization: manifest as unknown as ShowcaseAuthorization };
}

function assertTrustedOwnerEvidence(manifest: Record<string, unknown>): void {
  const evidence = manifest.restoreEvidence;
  if (manifest.trustedOwner !== true || !isRecord(manifest.source) || manifest.source.fingerprint !== TRUSTED_LOCAL_FINGERPRINT || !isHash(manifest.baselineDumpSha256) || !isRecord(evidence) || evidence.verified !== true || evidence.dumpSha256 !== manifest.baselineDumpSha256 || !isHash(evidence.sourceBaselineDigest) || evidence.restoredBaselineDigest !== evidence.sourceBaselineDigest || typeof evidence.description !== "string" || !evidence.description.trim() || !isRecord(evidence.destination)) {
    throw new Error("Trusted-owner authorization requires verified backup restoration evidence.");
  }
  const restored = evidence.destination;
  if (restored.host !== "127.0.0.1" || typeof restored.port !== "number" || !Number.isInteger(restored.port) || restored.port < 1 || restored.port > 65535 || restored.port === 5432 || restored.schema !== "public" || typeof restored.database !== "string" || !/^entrenar_crm_demo_[a-z0-9_]+$/.test(restored.database)) {
    throw new Error("Trusted-owner backup must be verified on an isolated restore destination.");
  }
  const canonical = identifyDatabaseTarget(`postgresql://127.0.0.1:${restored.port}/${restored.database}?schema=public`);
  if (restored.fingerprint !== canonical.fingerprint || restored.hostAddress !== undefined || manifest.source.host !== "127.0.0.1" || manifest.source.port !== 5432 || manifest.source.database !== "entrenar" || manifest.source.schema !== "public" || manifest.source.hostAddress !== undefined) {
    throw new Error("Trusted-owner backup evidence identity is inconsistent.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isHash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
