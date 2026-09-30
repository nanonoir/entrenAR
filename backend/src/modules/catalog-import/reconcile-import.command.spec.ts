import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "../catalog-scraper/run/run-store";
import { runCatalogImportReconciliation } from "./reconcile-import.command";

async function fixture(): Promise<{ args: string[]; store: RunStore; targetFingerprint: string }> {
  const root = await mkdtemp(join(tmpdir(), "import-reconciliation-"));
  const store = new RunStore(root);
  const run = await store.allocate("run-reconcile");
  await store.transition(run.runId, RUN_STATUS.EXTRACTING);
  const manifest = "{\"products\":[]}";
  const frozen = await store.freezePreparation(run.runId, {
    "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": manifest,
    "inventory.json": "[]", "report.md": "NOT_READY",
  }, [], {});
  const targetFingerprint = "a".repeat(64);
  await store.save({ ...frozen, status: RUN_STATUS.READY, targetFingerprint });
  await store.transition(run.runId, RUN_STATUS.IMPORTING);
  await store.transition(run.runId, RUN_STATUS.RECONCILIATION_REQUIRED);
  return {
    store,
    targetFingerprint,
    args: [
      store.path(run.runId, "products.json"),
      `--run-id=${run.runId}`,
      `--manifest-sha256=${digest(manifest)}`,
      `--run-root=${root}`,
      `--confirm-db-fingerprint=${targetFingerprint}`,
    ],
  };
}

describe("catalog import reconciliation command", () => {
  it("corrects only matching read-only evidence and never retries persistence", async () => {
    const value = await fixture();
    const reconcile = jest.fn().mockResolvedValue({ matches: true, mismatches: [], counts: { products: 1, variants: 2, images: 3, categoryLinks: 4 } });
    const output = jest.fn();
    await expect(runCatalogImportReconciliation(value.args, {
      target: { environmentFingerprint: async () => value.targetFingerprint, productCount: async () => 1 },
      reconcile,
      output,
    })).resolves.toBe(0);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect((await value.store.load("run-reconcile")).status).toBe(RUN_STATUS.IMPORTED);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "IMPORTED_RECONCILED" }));
  });

  it("keeps the run blocked when exact rows do not match", async () => {
    const value = await fixture();
    const reconcile = jest.fn().mockResolvedValue({ matches: false, mismatches: ["IMAGE_ROWS_MISMATCH"], counts: { products: 1, variants: 2, images: 2, categoryLinks: 4 } });
    const output = jest.fn();
    await expect(runCatalogImportReconciliation(value.args, {
      target: { environmentFingerprint: async () => value.targetFingerprint, productCount: async () => 1 },
      reconcile,
      output,
    })).resolves.toBe(2);
    expect((await value.store.load("run-reconcile")).status).toBe(RUN_STATUS.RECONCILIATION_REQUIRED);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "RECONCILIATION_REQUIRED" }));
  });
});
