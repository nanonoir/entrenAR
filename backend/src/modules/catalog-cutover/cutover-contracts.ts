import type { Prisma } from "../../generated/prisma/client";

export const CUTOVER_CLASSIFICATION = {
  MOCK: "mock",
  PRESERVED: "preserved",
  UNKNOWN: "unknown",
} as const;

export type CutoverClassification = (typeof CUTOVER_CLASSIFICATION)[keyof typeof CUTOVER_CLASSIFICATION];

export const CUTOVER_BASIS = {
  OWNER_ATTESTATION: "owner-attestation",
  POLICY: "policy",
  UNKNOWN: "unknown",
} as const;

export type CutoverBasis = (typeof CUTOVER_BASIS)[keyof typeof CUTOVER_BASIS];

export const CUTOVER_MODE = {
  AUDIT: "audit",
  BACKUP: "backup",
  CLEANUP: "cleanup",
  RECONCILE: "reconcile",
  IMPORT: "import",
} as const;

export type CutoverMode = (typeof CUTOVER_MODE)[keyof typeof CUTOVER_MODE];

export interface AuditRow {
  model: string;
  ref: string;
  rowDigest: string;
  classification: CutoverClassification;
  basis: CutoverBasis;
  edgeRefs: string[];
  blockers: string[];
}

export interface AuditEdge {
  from: string;
  to: string;
  field: string;
  kind: "foreign-key" | "typed-reference" | "group";
  deleteEffect: "Cascade" | "SetNull" | "Restrict" | "NoAction" | "unknown";
}

export interface SnapshotRecord {
  model: string;
  ref: string;
  rowDigest: string;
  row: Readonly<Record<string, unknown>>;
}

export interface ForeignKeyEvidence {
  constraint: string;
  fromModel: string;
  fromFields: readonly string[];
  toModel: string;
  toFields: readonly string[];
  deleteEffect: AuditEdge["deleteEffect"];
}

export interface CatalogSnapshot {
  snapshotId: string;
  targetFingerprint: string;
  schema: string;
  populationDigest: string;
  counts: Readonly<Record<string, number>>;
  records: readonly SnapshotRecord[];
  foreignKeys: readonly ForeignKeyEvidence[];
  blockers: readonly string[];
}

export interface ClassifiedPopulation {
  attestation: OwnerAttestation;
  rows: readonly AuditRow[];
  edges: readonly AuditEdge[];
  selectors: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  fixtureSources: readonly string[];
  blockers: readonly string[];
}

export interface OwnerAttestation {
  owner: string;
  confirmedAt: string;
  statement: string;
  prdDigest: string;
  targetFingerprint: string;
  auditId: string;
  populationDigest: string;
}

export interface CutoverApproval {
  kind: "cleanup";
  approver: string;
  confirmedAt: string;
  attestationDigest: string;
  evidenceDigest: string;
  selectorDigest: string;
  deletionDigest: string;
  runId: string;
  manifestSha256: string;
  targetFingerprint: string;
}

export interface ImportCutoverApproval {
  kind: "import";
  approver: string;
  confirmedAt: string;
  targetFingerprint: string;
  auditId: string;
  evidenceDigest: string;
  cleanupReceiptDigest: string;
  runId: string;
  manifestSha256: string;
}

export interface CutoverEvidenceV3 {
  version: 3;
  auditId: string;
  targetFingerprint: string;
  schema: string;
  schemaDigest: string;
  populationDigest: string;
  deletionDigest: string;
  selectorDigest: string;
  preservedDigest: string;
  counts: Readonly<Record<string, number>>;
  rows: readonly AuditRow[];
  edges: readonly AuditEdge[];
  fixtureSources: readonly string[];
  backup?: BackupEvidence;
  blockers: readonly string[];
}

export interface BackupEvidence {
  path: string;
  size: number;
  sha256: string;
  scratchFingerprint: string;
  restoredPopulationDigest: string;
  deletionCoverage: number;
}

export interface ModelPageClient {
  $transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
}
