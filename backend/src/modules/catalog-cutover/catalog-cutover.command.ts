import "reflect-metadata";

import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PrismaClient } from "../../generated/prisma/client";
import { assertManifestApproval, type ImportAssetReadinessPort, type ImportApproval, type ImportTargetPort } from "../catalog-import/approval";
import { readR2Environment, verifyExactSet } from "../catalog-scraper/storage/r2-storage";
import { S3R2StorageAdapter } from "../catalog-scraper/storage/s3-r2-storage.adapter";
import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { CatalogCutoverRepository, hashCanonical } from "./catalog-cutover.repository";
import { CatalogCutoverService, OWNER_ATTESTATION_STATEMENT } from "./catalog-cutover.service";
import { BackupRehearsal } from "./backup-rehearsal";
import { CUTOVER_MODE, type CutoverMode, type CutoverApproval, type CutoverEvidenceV3, type ImportCutoverApproval, type OwnerAttestation, type BackupEvidence } from "./cutover-contracts";

export interface ParsedCutoverArgs {
  mode: CutoverMode;
  values: ReadonlyMap<string, string>;
}

export interface CutoverCommandOperations {
  audit(input: { owner: string; confirmedAt: string; statement: string; prdDigest: string; confirmedFingerprint: string }): ReturnType<CatalogCutoverService["audit"]>;
  assertCleanupApproval(evidence: CutoverEvidenceV3, evidenceDigest: string, attestation: OwnerAttestation, approval: CutoverApproval, backup: BackupEvidence | undefined, confirmedFingerprint: string): void;
  assertImportApproval(evidence: CutoverEvidenceV3, cleanupReceiptDigest: string, approval: ImportCutoverApproval, confirmedFingerprint: string): void;
  rehearseBackup(input: { owner: string; confirmedAt: string; statement: string; prdDigest: string; confirmedFingerprint: string; archivePath: string; scratchConnectionString: string }): ReturnType<CatalogCutoverService["rehearseBackup"]>;
  cleanup(evidence: CutoverEvidenceV3, evidenceDigest: string, attestation: OwnerAttestation, approval: CutoverApproval, confirmedFingerprint: string): ReturnType<CatalogCutoverService["cleanup"]>;
  reconcileCleanup(evidence: CutoverEvidenceV3): ReturnType<CatalogCutoverService["reconcileCleanup"]>;
}

export interface CatalogCutoverCommandDependencies {
  service?: CutoverCommandOperations;
  output?: (value: unknown) => void;
  readText?: (path: string) => Promise<string>;
  validateExistingImport?: (manifestPath: string, approval: ImportApproval) => Promise<void>;
}

export const CATALOG_CUTOVER_EXIT_CODE = { SUCCESS: 0, BLOCKED: 2 } as const;

const MODE_FLAGS: Readonly<Record<CutoverMode, readonly string[]>> = {
  audit: ["owner", "confirmed-at", "statement", "prd-sha256", "confirm-db-fingerprint"],
  backup: ["owner", "confirmed-at", "statement", "prd-sha256", "archive", "scratch-database-url", "confirm-db-fingerprint"],
  cleanup: ["evidence-file", "attestation-file", "approval-file", "confirm-db-fingerprint"],
  reconcile: ["evidence-file"],
  import: ["evidence-file", "approval-file", "cleanup-receipt-sha256", "manifest-path", "run-root", "confirm-db-fingerprint"],
};

export function parseCutoverArgs(argv: readonly string[]): ParsedCutoverArgs {
  const values = new Map<string, string>();
  for (const argument of argv) {
    const match = /^--([a-z][a-z0-9-]*)=(.*)$/.exec(argument);
    if (!match || values.has(match[1]!)) throw new Error("Unknown or duplicate cutover argument.");
    values.set(match[1]!, match[2]!);
  }
  const mode = values.get("mode");
  if (!mode || !Object.values(CUTOVER_MODE).includes(mode as CutoverMode)) throw new Error("An explicit cutover mode is required.");
  const allowed = new Set(["mode", ...MODE_FLAGS[mode as CutoverMode]]);
  if ([...values.keys()].some((key) => !allowed.has(key)) || MODE_FLAGS[mode as CutoverMode].some((key) => !values.get(key))) {
    throw new Error("Cutover mode arguments are incomplete or unsupported.");
  }
  return { mode: mode as CutoverMode, values };
}

export async function runCatalogCutoverCommand(
  argv = process.argv.slice(2),
  dependencies: CatalogCutoverCommandDependencies = {},
): Promise<number> {
  let prisma: PrismaService | undefined;
  const output = dependencies.output ?? ((value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`));
  const readText = dependencies.readText ?? ((path: string) => readFile(path, "utf8"));
  try {
    const parsed = parseCutoverArgs(argv);
    let service = dependencies.service;
    if (!service) {
      const hmacKey = process.env["CATALOG_CUTOVER_HMAC_KEY"];
      if (!hmacKey) throw new Error("Cutover evidence key is unavailable.");
      prisma = new PrismaService();
      const repository = new CatalogCutoverRepository(prisma, hmacKey);
      const backupRehearsal = new BackupRehearsal({
        readScratchSnapshot: async (connectionString) => {
          const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
          try {
            return await new CatalogCutoverRepository(client as unknown as PrismaService, hmacKey, () => identifyDatabaseTarget(connectionString).fingerprint).readSnapshot();
          } finally { await client.$disconnect(); }
        },
      });
      service = new CatalogCutoverService(repository, undefined, backupRehearsal);
    }
    if (parsed.mode === CUTOVER_MODE.AUDIT) {
      const result = await service.audit({
        owner: required(parsed.values, "owner"), confirmedAt: required(parsed.values, "confirmed-at"),
        statement: required(parsed.values, "statement"), prdDigest: required(parsed.values, "prd-sha256"),
        confirmedFingerprint: required(parsed.values, "confirm-db-fingerprint"),
      });
      output({ ok: result.evidence.blockers.length === 0, mode: parsed.mode, evidence: result.evidence, evidenceDigest: result.evidenceDigest,
        attestation: { ...result.attestation, statement: OWNER_ATTESTATION_STATEMENT, digest: digestAttestation(result.attestation) } });
      return result.evidence.blockers.length === 0 ? CATALOG_CUTOVER_EXIT_CODE.SUCCESS : CATALOG_CUTOVER_EXIT_CODE.BLOCKED;
    }
    if (parsed.mode === CUTOVER_MODE.BACKUP) {
      const result = await service.rehearseBackup({
        owner: required(parsed.values, "owner"), confirmedAt: required(parsed.values, "confirmed-at"), statement: OWNER_ATTESTATION_STATEMENT,
        prdDigest: required(parsed.values, "prd-sha256"), archivePath: required(parsed.values, "archive"),
        scratchConnectionString: required(parsed.values, "scratch-database-url"), confirmedFingerprint: required(parsed.values, "confirm-db-fingerprint"),
      });
      output({ ok: result.evidence.blockers.length === 0, mode: parsed.mode, evidence: result.evidence, evidenceDigest: result.evidenceDigest,
        attestation: { ...result.attestation, statement: OWNER_ATTESTATION_STATEMENT, digest: digestAttestation(result.attestation) } });
      return result.evidence.blockers.length === 0 ? CATALOG_CUTOVER_EXIT_CODE.SUCCESS : CATALOG_CUTOVER_EXIT_CODE.BLOCKED;
    }
    if (parsed.mode === CUTOVER_MODE.CLEANUP) {
      const { evidence, evidenceDigest } = parseEvidenceReport(await readText(required(parsed.values, "evidence-file")));
      const attestation = parseAttestation(await readText(required(parsed.values, "attestation-file")));
      const approval = parseApproval<CutoverApproval>(await readText(required(parsed.values, "approval-file")), "cleanup");
      const receipt = await service.cleanup(evidence, evidenceDigest, attestation, approval, required(parsed.values, "confirm-db-fingerprint"));
      output({ ok: true, mode: parsed.mode, receipt });
      return CATALOG_CUTOVER_EXIT_CODE.SUCCESS;
    }
    if (parsed.mode === CUTOVER_MODE.IMPORT) {
      const { evidence } = parseEvidenceReport(await readText(required(parsed.values, "evidence-file")));
      const approval = parseApproval<ImportCutoverApproval>(await readText(required(parsed.values, "approval-file")), "import");
      service.assertImportApproval(evidence, required(parsed.values, "cleanup-receipt-sha256"), approval, required(parsed.values, "confirm-db-fingerprint"));
      const importApproval: ImportApproval = {
        runId: approval.runId, manifestSha256: approval.manifestSha256,
        runRoot: required(parsed.values, "run-root"), environment: approval.targetFingerprint,
      };
      if (dependencies.validateExistingImport) await dependencies.validateExistingImport(required(parsed.values, "manifest-path"), importApproval);
      else {
        if (!prisma) throw new Error("Read-only importer preflight is unavailable.");
        const storage = new S3R2StorageAdapter({ environment: readR2Environment() });
        const target: ImportTargetPort = { environmentFingerprint: async () => identifyDatabaseTarget().fingerprint, productCount: () => prisma!.product.count() };
        const assets: ImportAssetReadinessPort = { destinationFingerprint: () => storage.destinationFingerprint(), verify: (expected) => verifyExactSet(storage, expected, true) };
        await assertManifestApproval(required(parsed.values, "manifest-path"), importApproval, target, assets);
      }
      output({ ok: true, mode: parsed.mode, code: "IMPORT_APPROVAL_BOUND", runId: approval.runId, manifestSha256: approval.manifestSha256 });
      return CATALOG_CUTOVER_EXIT_CODE.SUCCESS;
    }
    if (parsed.mode === CUTOVER_MODE.RECONCILE) {
      const { evidence } = parseEvidenceReport(await readText(required(parsed.values, "evidence-file")));
      const result = await service.reconcileCleanup(evidence);
      output({ ...result, mode: parsed.mode });
      return result.ok ? CATALOG_CUTOVER_EXIT_CODE.SUCCESS : CATALOG_CUTOVER_EXIT_CODE.BLOCKED;
    }
    throw new Error("Requested cutover mode is unavailable.");
  } catch {
    output({ ok: false, code: "CUTOVER_BLOCKED", message: "Cutover prerequisites are missing, stale, or unsafe." });
    return CATALOG_CUTOVER_EXIT_CODE.BLOCKED;
  } finally {
    if (prisma) await prisma.$disconnect().catch(() => undefined);
  }
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error("Required cutover argument is missing.");
  return value;
}

function parseEvidenceReport(value: string): { evidence: CutoverEvidenceV3; evidenceDigest: string } {
  const parsed: unknown = JSON.parse(value);
  const report = isRecord(parsed) && "evidence" in parsed ? parsed : undefined;
  const evidence = report?.["evidence"];
  const evidenceDigest = report?.["evidenceDigest"];
  if (!isRecord(evidence) || typeof evidenceDigest !== "string" || evidence["version"] !== 3 || typeof evidence["auditId"] !== "string" || typeof evidence["targetFingerprint"] !== "string" ||
    typeof evidence["schemaDigest"] !== "string" || typeof evidence["populationDigest"] !== "string" || typeof evidence["deletionDigest"] !== "string" || !Array.isArray(evidence["rows"]) || !Array.isArray(evidence["edges"]) || !Array.isArray(evidence["blockers"])) {
    throw new Error("Cutover evidence is invalid.");
  }
  return { evidence: evidence as unknown as CutoverEvidenceV3, evidenceDigest };
}

function parseApproval<T extends CutoverApproval | ImportCutoverApproval>(value: string, kind: T["kind"]): T {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || parsed["kind"] !== kind) throw new Error("Cutover approval kind does not match this mode.");
  return parsed as unknown as T;
}

function digestAttestation(attestation: OwnerAttestation): string {
  return hashCanonical(attestation);
}

function parseAttestation(value: string): OwnerAttestation {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || typeof parsed["owner"] !== "string" || typeof parsed["confirmedAt"] !== "string" || parsed["statement"] !== OWNER_ATTESTATION_STATEMENT ||
    typeof parsed["prdDigest"] !== "string" || typeof parsed["targetFingerprint"] !== "string" || typeof parsed["auditId"] !== "string" || typeof parsed["populationDigest"] !== "string") {
    throw new Error("Owner attestation is invalid.");
  }
  return { owner: parsed["owner"], confirmedAt: parsed["confirmedAt"], statement: parsed["statement"], prdDigest: parsed["prdDigest"], targetFingerprint: parsed["targetFingerprint"], auditId: parsed["auditId"], populationDigest: parsed["populationDigest"] };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
