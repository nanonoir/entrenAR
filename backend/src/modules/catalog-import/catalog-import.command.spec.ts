import { CATALOG_IMPORT_EXIT_CODE, runCatalogImportCommand } from "./catalog-import.command";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "../catalog-scraper/run/run-store";

async function approvedRun(): Promise<{ args: string[]; manifestPath: string; store: RunStore; runId: string; databaseFingerprint: string; r2Fingerprint: string }> {
  const root = await mkdtemp(join(tmpdir(), "catalog-import-command-"));
  const runId = "run-import-command";
  const store = new RunStore(root);
  const manifest = Buffer.from('{"products":[]}');
  const inventory = Buffer.from("[]");
  const manifestPath = store.path(runId, "products.json");
  const run = await store.allocate(runId);
  await store.writeImmutable(runId, "products.json", manifest);
  await store.writeImmutable(runId, "inventory.json", inventory);
  const databaseFingerprint = "a".repeat(64);
  const r2Fingerprint = "c".repeat(64);
  await store.save({ ...run, status: RUN_STATUS.READY, targetFingerprint: databaseFingerprint, r2DestinationFingerprint: r2Fingerprint, manifestSha256: digest(manifest), fileDigests: { "products.json": digest(manifest), "inventory.json": digest(inventory) } });
  return {
    store,
    runId,
    manifestPath,
    databaseFingerprint,
    r2Fingerprint,
    args: [manifestPath, `--run-id=${runId}`, `--manifest-sha256=${digest(manifest)}`, `--run-root=${root}`, `--confirm-db-fingerprint=${databaseFingerprint}`],
  };
}

describe("catalog import command", () => {
  it("emits a stable redacted report when the input path is missing", async () => {
    const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      await expect(runCatalogImportCommand("")).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE);
      expect(write).toHaveBeenCalledWith(expect.stringContaining('"code":"MISSING_INPUT"'));
      expect(write).not.toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    } finally {
      write.mockRestore();
    }
  });

  it("requires approval, revalidates both targets, and records committed counts", async () => {
    const value = await approvedRun();
    const service = { importCatalog: jest.fn().mockResolvedValue({ ok: true, counts: { products: 1, variants: 2, images: 3, categoryLinks: 4 } }) };
    const output = jest.fn();
    await expect(runCatalogImportCommand(value.manifestPath, {
      argv: value.args,
      service,
      target: { environmentFingerprint: async () => value.databaseFingerprint, productCount: async () => 0 },
      assets: { destinationFingerprint: () => value.r2Fingerprint, verify: jest.fn().mockResolvedValue(undefined) },
      output,
    })).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.SUCCESS);
    expect(service.importCatalog).toHaveBeenCalledWith({ products: [] }, value.runId);
    expect((await value.store.load(value.runId)).status).toBe(RUN_STATUS.IMPORTED);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("does not import for a changed DB or R2 target", async () => {
    const value = await approvedRun();
    const service = { importCatalog: jest.fn() };
    const output = jest.fn();
    await expect(runCatalogImportCommand(value.manifestPath, {
      argv: value.args,
      service,
      target: { environmentFingerprint: async () => "b".repeat(64), productCount: async () => 0 },
      assets: { destinationFingerprint: () => value.r2Fingerprint, verify: jest.fn() },
      output,
    })).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE);
    expect(service.importCatalog).not.toHaveBeenCalled();
    expect((await value.store.load(value.runId)).status).toBe(RUN_STATUS.READY);
  });

  it("marks commit-success receipt failure as reconciliation-required and prevents retry", async () => {
    const value = await approvedRun();
    const service = { importCatalog: jest.fn().mockResolvedValue({ ok: true, counts: { products: 1, variants: 1, images: 1, categoryLinks: 1 } }) };
    const output = jest.fn();
    const receipt = jest.spyOn(RunStore.prototype, "recordImportOutcome").mockRejectedValue(new Error("disk failure"));
    try {
      await expect(runCatalogImportCommand(value.manifestPath, {
        argv: value.args,
        service,
        target: { environmentFingerprint: async () => value.databaseFingerprint, productCount: async () => 0 },
        assets: { destinationFingerprint: () => value.r2Fingerprint, verify: jest.fn() },
        output,
      })).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE);
      expect((await value.store.load(value.runId)).status).toBe(RUN_STATUS.RECONCILIATION_REQUIRED);
      expect(output).toHaveBeenCalledWith({ ok: false, code: "RECONCILIATION_REQUIRED", runId: value.runId });
    } finally {
      receipt.mockRestore();
    }
  });

  it("treats an indeterminate persistence acknowledgement as non-retryable reconciliation work", async () => {
    const value = await approvedRun();
    const service = { importCatalog: jest.fn().mockResolvedValue({ ok: false, issues: [{ code: "PERSISTENCE_FAILURE", message: "Catalog import could not be completed." }] }) };
    const output = jest.fn();
    await expect(runCatalogImportCommand(value.manifestPath, {
      argv: value.args,
      service,
      target: { environmentFingerprint: async () => value.databaseFingerprint, productCount: async () => 0 },
      assets: { destinationFingerprint: () => value.r2Fingerprint, verify: jest.fn() },
      output,
    })).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE);
    expect((await value.store.load(value.runId)).status).toBe(RUN_STATUS.RECONCILIATION_REQUIRED);
    expect(output).toHaveBeenCalledWith({ ok: false, code: "RECONCILIATION_REQUIRED", runId: value.runId });
  });
});
