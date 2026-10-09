import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { CatalogCutoverService, FROZEN_CATALOG_RUN, OWNER_ATTESTATION_STATEMENT } from "./catalog-cutover.service";
import { CATALOG_CUTOVER_EXIT_CODE, parseCutoverArgs, runCatalogCutoverCommand } from "./catalog-cutover.command";
import { hashCanonical } from "./catalog-cutover.repository";
import type { CatalogSnapshot, CutoverApproval, CutoverEvidenceV3, ImportCutoverApproval, OwnerAttestation } from "./cutover-contracts";

describe("catalog cutover mode and approval gates", () => {
  const connection = "postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public";
  const target = identifyDatabaseTarget(connection);

  it("requires one explicit supported mode and rejects duplicate or implicit write flags", () => {
    expect(() => parseCutoverArgs([])).toThrow("explicit cutover mode");
    expect(() => parseCutoverArgs(["--mode=audit", "--mode=cleanup"])).toThrow("duplicate");
    expect(() => parseCutoverArgs(["--mode=cleanup", "--confirm-db-fingerprint=x"])).toThrow("incomplete or unsupported");
    expect(parseCutoverArgs(["--mode=import", "--evidence-file=e", "--approval-file=a", "--cleanup-receipt-sha256=d", "--manifest-path=m", "--run-root=r", "--confirm-db-fingerprint=f"]).mode).toBe("import");
    expect(parseCutoverArgs(["--mode=reconcile", "--evidence-file=e"]).mode).toBe("reconcile");
  });

  it("binds audit to the confirmed local target and returns only hashed row references", async () => {
    const snapshot = snapshotOf([{ model: "Product", ref: "hmac-ref", rowDigest: "private-row-digest", row: { id: "p1", name: "private product" } }]);
    const service = new CatalogCutoverService({ readSnapshot: async () => snapshot }, () => target);
    const result = await service.audit({
      owner: "owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: OWNER_ATTESTATION_STATEMENT, prdDigest: "a".repeat(64),
      confirmedFingerprint: target.fingerprint,
    });

    expect(result.evidence.rows[0]).toMatchObject({ ref: "hmac-ref", model: "Product", classification: "mock" });
    expect(JSON.stringify(result.evidence)).not.toContain("private product");
    expect(result.evidence.populationDigest).toBe(snapshot.populationDigest);
    await expect(service.audit({ owner: "owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: OWNER_ATTESTATION_STATEMENT, prdDigest: "a".repeat(64), confirmedFingerprint: "0".repeat(64) })).rejects.toThrow("confirmed");
  });

  it("rejects cleanup evidence tampering and stale or unrelated approvals", async () => {
    const service = new CatalogCutoverService({ readSnapshot: async () => snapshotOf([{ model: "Product", ref: "ref", rowDigest: "digest", row: { id: "p1" } }]) }, () => target);
    const audit = await service.audit({ owner: "owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: OWNER_ATTESTATION_STATEMENT, prdDigest: "a".repeat(64), confirmedFingerprint: target.fingerprint });
    const attestation = audit.attestation;
    const approval: CutoverApproval = {
      kind: "cleanup", approver: "owner", confirmedAt: "2026-10-01T00:00:00.000Z", attestationDigest: hashCanonical(attestation),
      evidenceDigest: audit.evidenceDigest, selectorDigest: audit.evidence.selectorDigest, deletionDigest: audit.evidence.deletionDigest,
      runId: FROZEN_CATALOG_RUN.ID, manifestSha256: FROZEN_CATALOG_RUN.MANIFEST_SHA256, targetFingerprint: target.fingerprint,
    };
    const backup = { path: "backend/backup/<private-archive>", size: 100, sha256: "b".repeat(64), scratchFingerprint: "scratch", restoredPopulationDigest: audit.evidence.populationDigest, deletionCoverage: 1 };

    expect(() => service.assertCleanupApproval({ ...audit.evidence, deletionDigest: "changed" }, audit.evidenceDigest, attestation, approval, backup, target.fingerprint)).toThrow("stale");
    expect(() => service.assertCleanupApproval(audit.evidence, audit.evidenceDigest, attestation, { ...approval, kind: "import" } as unknown as CutoverApproval, backup, target.fingerprint)).toThrow("prerequisites");
  });

  it("keeps cleanup and import approval kinds independent and CLI failure sanitized", async () => {
    const evidence = minimalEvidence(target.fingerprint);
    const importApproval: ImportCutoverApproval = {
      kind: "import", approver: "owner", confirmedAt: "2026-10-01T00:00:00.000Z", targetFingerprint: target.fingerprint,
      auditId: evidence.auditId, evidenceDigest: hashCanonical(evidence), cleanupReceiptDigest: "c".repeat(64),
      runId: FROZEN_CATALOG_RUN.ID, manifestSha256: FROZEN_CATALOG_RUN.MANIFEST_SHA256,
    };
    let gateCalled = false;
    const output: unknown[] = [];
    const code = await runCatalogCutoverCommand([
      "--mode=import", "--evidence-file=evidence.json", "--approval-file=approval.json", `--cleanup-receipt-sha256=${"c".repeat(64)}`,
      "--manifest-path=manifest.json", "--run-root=run-root", `--confirm-db-fingerprint=${target.fingerprint}`,
    ], {
      readText: async (path) => path === "evidence.json"
        ? JSON.stringify({ evidence, evidenceDigest: hashCanonical(evidence) })
        : JSON.stringify(importApproval),
      validateExistingImport: async () => undefined,
      service: {
        audit: async () => { throw new Error("not used"); },
        assertCleanupApproval: () => { throw new Error("not used"); },
        assertImportApproval: () => { gateCalled = true; },
        rehearseBackup: async () => { throw new Error("not used"); },
        cleanup: async () => { throw new Error("not used"); },
        reconcileCleanup: async () => ({ ok: true, blockers: [] }),
      },
      output: (value) => output.push(value),
    });

    expect(code).toBe(CATALOG_CUTOVER_EXIT_CODE.SUCCESS);
    expect(gateCalled).toBe(true);
    expect(output).toEqual([expect.objectContaining({ code: "IMPORT_APPROVAL_BOUND", mode: "import" })]);
  });

  it("does not expose dependency error details in CLI output", async () => {
    const output: unknown[] = [];
    const code = await runCatalogCutoverCommand(["--mode=audit", "--owner=x", "--confirmed-at=x", "--statement=secret", "--prd-sha256=x", "--confirm-db-fingerprint=x"], {
      service: {
        audit: async () => { throw new Error("customer@example.com password=secret"); },
        assertCleanupApproval: () => undefined,
        assertImportApproval: () => undefined,
        rehearseBackup: async () => { throw new Error("not used"); },
        cleanup: async () => { throw new Error("not used"); },
        reconcileCleanup: async () => ({ ok: true, blockers: [] }),
      },
      output: (value) => output.push(value),
    });

    expect(code).toBe(CATALOG_CUTOVER_EXIT_CODE.BLOCKED);
    expect(JSON.stringify(output)).not.toContain("customer@example.com");
    expect(JSON.stringify(output)).not.toContain("secret");
  });
});

function snapshotOf(records: CatalogSnapshot["records"]): CatalogSnapshot {
  return { snapshotId: "audit", targetFingerprint: identifyDatabaseTarget("postgresql://u:p@127.0.0.1:5432/entrenar?schema=public").fingerprint,
    schema: "public", populationDigest: "complete-population", counts: {}, records, foreignKeys: [], blockers: [] };
}

function minimalEvidence(targetFingerprint: string): CutoverEvidenceV3 {
  return { version: 3, auditId: "audit", targetFingerprint, schema: "public", schemaDigest: "schema", populationDigest: "population", deletionDigest: "deletion",
    selectorDigest: "selector", preservedDigest: "preserved", counts: {}, rows: [], edges: [], fixtureSources: [], blockers: [] };
}
