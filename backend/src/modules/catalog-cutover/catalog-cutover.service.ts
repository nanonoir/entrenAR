import { CUTOVER_CLASSIFICATION, type BackupEvidence, type CatalogSnapshot, type ClassifiedPopulation, type CutoverApproval, type CutoverEvidenceV3, type ImportCutoverApproval, type OwnerAttestation } from "./cutover-contracts";
import { classifyOwnerAttestedPopulation } from "./fixture-provenance";
import { hashCanonical, preservedPopulationDigest, SNAPSHOT_MODELS, type ApprovedDeletionSelector, type CleanupRepositoryInput, type CleanupRepositoryReceipt } from "./catalog-cutover.repository";
import { identifyDatabaseTarget, type DatabaseTargetIdentity } from "../catalog-scraper/operations/database-target";
import { BackupRehearsal } from "./backup-rehearsal";

export const FROZEN_CATALOG_RUN = {
  ID: "run-20260928232548266-6ca4606a",
  MANIFEST_SHA256: "5093a00949525fec13f8814f680a51d50823e3748a3b1d3306c105f6aa218dd6",
} as const;
export const OWNER_ATTESTATION_STATEMENT = "All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required.";

export interface CutoverSnapshotPort {
  readSnapshot(): Promise<CatalogSnapshot>;
  cleanupApproved?(input: CleanupRepositoryInput): Promise<CleanupRepositoryReceipt>;
}

export interface CutoverAuditInput {
  owner: string;
  confirmedAt: string;
  statement: string;
  prdDigest: string;
  confirmedFingerprint: string;
}

export interface CutoverAuditResult {
  evidence: CutoverEvidenceV3;
  evidenceDigest: string;
  attestation: OwnerAttestation;
  selectors: ClassifiedPopulation["selectors"];
  snapshot: CatalogSnapshot;
}

export class CatalogCutoverService {
  constructor(
    private readonly repository: CutoverSnapshotPort,
    private readonly target: () => DatabaseTargetIdentity = () => identifyDatabaseTarget(),
    private readonly backupRehearsal?: BackupRehearsal,
  ) {}

  async audit(input: CutoverAuditInput): Promise<CutoverAuditResult> {
    const target = this.target();
    assertConfirmedLocalTarget(target, input.confirmedFingerprint);
    if (input.statement !== OWNER_ATTESTATION_STATEMENT) throw new Error("Owner attestation statement does not match the approved product rule.");
    const snapshot = await this.repository.readSnapshot();
    if (snapshot.targetFingerprint !== target.fingerprint) throw new Error("Database target changed during snapshot audit.");
    const population: ClassifiedPopulation = classifyOwnerAttestedPopulation(snapshot, input);
    const rows = population.rows;
    const deletionDigest = hashCanonical(rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
    const selectorDigest = hashCanonical(rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK).map(({ model, ref }) => ({
      model, ref, fields: model === "CustomerAddress" ? ["customerId"] : SNAPSHOT_MODELS.find((definition) => definition.name === model)?.primaryKey ?? [],
    })));
    const preservedDigest = hashCanonical(rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.PRESERVED).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
    const evidence: CutoverEvidenceV3 = {
      version: 3, auditId: snapshot.snapshotId, targetFingerprint: snapshot.targetFingerprint, schema: snapshot.schema, schemaDigest: hashCanonical(snapshot.foreignKeys),
      populationDigest: snapshot.populationDigest, deletionDigest, selectorDigest, preservedDigest, counts: snapshot.counts,
      rows, edges: population.edges, fixtureSources: population.fixtureSources, blockers: population.blockers,
    };
    return { evidence, evidenceDigest: hashCanonical(evidence), attestation: population.attestation, selectors: population.selectors, snapshot };
  }

  async rehearseBackup(input: CutoverAuditInput & { archivePath: string; scratchConnectionString: string }): Promise<CutoverAuditResult> {
    if (!this.backupRehearsal) throw new Error("Backup rehearsal is unavailable.");
    const audit = await this.audit(input);
    const target = this.target();
    if (target.fingerprint !== audit.evidence.targetFingerprint) throw new Error("Database target changed after the backup audit.");
    const backup = await this.backupRehearsal.rehearse({
      archivePath: input.archivePath, target, scratchConnectionString: input.scratchConnectionString,
      expectedSnapshot: audit.snapshot, deletionRefs: audit.evidence.rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK).map(({ ref }) => ref),
    });
    const evidence = { ...audit.evidence, backup };
    return { ...audit, evidence, evidenceDigest: hashCanonical(evidence) };
  }

  async cleanup(
    evidence: CutoverEvidenceV3,
    evidenceDigest: string,
    attestation: OwnerAttestation,
    approval: CutoverApproval,
    confirmedFingerprint: string,
  ): Promise<CleanupRepositoryReceipt> {
    this.assertCleanupApproval(evidence, evidenceDigest, attestation, approval, evidence.backup, confirmedFingerprint);
    if (!this.repository.cleanupApproved) throw new Error("Atomic cleanup repository is unavailable.");
    const current = await this.repository.readSnapshot();
    if (current.populationDigest !== evidence.populationDigest || hashCanonical(current.foreignKeys) !== evidence.schemaDigest || current.targetFingerprint !== evidence.targetFingerprint) {
      throw new Error("Cutover scope or schema drifted after approval.");
    }
    const approvedRows = evidence.rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK);
    const selectedRefs = new Set(approvedRows.map(({ ref }) => ref));
    const currentByRef = new Map(current.records.map((record) => [record.ref, record]));
    const selectors: ApprovedDeletionSelector[] = approvedRows.map((approved) => {
      const record = currentByRef.get(approved.ref);
      if (!record || record.rowDigest !== approved.rowDigest || record.model !== approved.model) throw new Error("Approved row is missing or changed.");
      const fields = record.model === "CustomerAddress" ? ["customerId"] : SNAPSHOT_MODELS.find(({ name }) => name === record.model)?.primaryKey;
      if (!fields) throw new Error("Approved row model has no safe key definition.");
      const values = fields.map((field) => record.row[field]);
      if (values.some((value) => typeof value !== "string")) throw new Error("Approved row selector is malformed.");
      return { model: record.model, ref: record.ref, fields, values: values as string[] };
    });
    const preservedDigest = preservedPopulationDigest(current.records.filter(({ ref }) => !selectedRefs.has(ref)));
    if (preservedDigest !== evidence.preservedDigest) throw new Error("Preserved state differs from approved evidence.");
    return this.repository.cleanupApproved({
      targetFingerprint: evidence.targetFingerprint, populationDigest: evidence.populationDigest, foreignKeyDigest: evidence.schemaDigest,
      selectedRefs: approvedRows.map(({ ref }) => ref), selectors, edges: evidence.edges, preservedDigest,
    });
  }

  async reconcileCleanup(evidence: CutoverEvidenceV3): Promise<{ ok: boolean; blockers: string[] }> {
    const snapshot = await this.repository.readSnapshot();
    const selectedRefs = new Set(evidence.rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK).map(({ ref }) => ref));
    const blockers: string[] = [];
    if (snapshot.targetFingerprint !== evidence.targetFingerprint) blockers.push("TARGET_MISMATCH");
    if (snapshot.records.some(({ ref }) => selectedRefs.has(ref))) blockers.push("APPROVED_ROWS_REMAIN");
    if ((snapshot.counts["Product"] ?? -1) !== 0) blockers.push("PRODUCTS_REMAIN");
    if ((snapshot.counts["Category"] ?? -1) !== 61) blockers.push("CATEGORY_COUNT_MISMATCH");
    const preservedRows = evidence.rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.PRESERVED).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest }));
    const currentPreserved = snapshot.records.filter(({ ref }) => !selectedRefs.has(ref)).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest }));
    if (hashCanonical(preservedRows) !== hashCanonical(currentPreserved)) blockers.push("PRESERVED_STATE_MISMATCH");
    return { ok: blockers.length === 0, blockers };
  }


  assertCleanupApproval(
    evidence: CutoverEvidenceV3,
    evidenceDigest: string,
    attestation: OwnerAttestation,
    approval: CutoverApproval,
    backup: BackupEvidence | undefined,
    confirmedFingerprint: string,
  ): void {
    assertConfirmedLocalTarget(this.target(), confirmedFingerprint);
    if (approval.kind !== "cleanup" || evidence.blockers.length || !backup || backup.size <= 0 || !isSha256(backup.sha256) || backup.deletionCoverage !== 1 || backup.scratchFingerprint === evidence.targetFingerprint || backup.restoredPopulationDigest !== evidence.populationDigest) throw new Error("Cleanup prerequisites are incomplete.");
    const attestedPopulationDigest = hashCanonical(evidence.rows.filter(({ classification }) => classification === CUTOVER_CLASSIFICATION.MOCK).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
    if (attestation.statement !== OWNER_ATTESTATION_STATEMENT || !attestation.owner.trim() || !isSha256(attestation.prdDigest) || !isIsoTimestamp(attestation.confirmedAt) ||
      attestation.auditId !== evidence.auditId || attestation.populationDigest !== attestedPopulationDigest || attestation.targetFingerprint !== evidence.targetFingerprint) {
      throw new Error("Owner attestation does not match the audited population.");
    }
    if (!approval.approver.trim() || !isIsoTimestamp(approval.confirmedAt) || approval.runId !== FROZEN_CATALOG_RUN.ID || approval.manifestSha256 !== FROZEN_CATALOG_RUN.MANIFEST_SHA256 ||
      approval.targetFingerprint !== evidence.targetFingerprint || approval.evidenceDigest !== evidenceDigest || evidenceDigest !== hashCanonical(evidence) ||
      approval.selectorDigest !== evidence.selectorDigest || approval.deletionDigest !== evidence.deletionDigest || approval.attestationDigest !== hashCanonical(attestation)) {
      throw new Error("Cleanup approval is stale or bound to different evidence.");
    }
  }

  assertImportApproval(evidence: CutoverEvidenceV3, cleanupReceiptDigest: string, approval: ImportCutoverApproval, confirmedFingerprint: string): void {
    assertConfirmedLocalTarget(this.target(), confirmedFingerprint);
    if (approval.kind !== "import" || !approval.approver.trim() || !isIsoTimestamp(approval.confirmedAt) || approval.runId !== FROZEN_CATALOG_RUN.ID || approval.manifestSha256 !== FROZEN_CATALOG_RUN.MANIFEST_SHA256 ||
      approval.targetFingerprint !== evidence.targetFingerprint || approval.auditId !== evidence.auditId || approval.evidenceDigest !== hashCanonical(evidence) || approval.cleanupReceiptDigest !== cleanupReceiptDigest) {
      throw new Error("Independent import approval is missing, stale, or bound to different evidence.");
    }
  }
}

export function assertConfirmedLocalTarget(target: DatabaseTargetIdentity, confirmedFingerprint: string): void {
  if (target.host !== "127.0.0.1" || target.port !== 5432 || target.database !== "entrenar" || target.schema !== "public" || target.fingerprint !== confirmedFingerprint) {
    throw new Error("Cutover target must be the confirmed 127.0.0.1:5432/entrenar/public database.");
  }
}

function isSha256(value: string): boolean { return /^[a-f0-9]{64}$/i.test(value); }
function isIsoTimestamp(value: string): boolean { return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
