import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunStore, RUN_STATUS, digest } from "./run-store";
import { listAll, resetProductsPrefix, uploadExactSet, type R2StoragePort, type ObjectMetadata } from "../storage/r2-storage";

describe("catalog run and safe storage boundaries", () => {
  it("freezes immutable evidence and rejects a second write", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-run-")); const store = new RunStore(root); const run = await store.allocate("run-fixture"); await store.transition(run.runId, RUN_STATUS.EXTRACTING); const record = await store.freeze(run.runId, "source", "taxonomy", JSON.stringify({ products: [] }));
    expect(record.status).toBe(RUN_STATUS.SNAPSHOT_FROZEN); expect(record.sourceSha256).toBe(digest("source")); await expect(store.writeImmutable(run.runId, "source.json", "changed")).rejects.toThrow("Immutable"); expect(await readFile(store.path(run.runId, "source.json"), "utf8")).toBe("source");
  });
  it("allocates exclusive run directories and publishes all preparation payloads before run evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-prepared-run-")); const store = new RunStore(root); const run = await store.allocate("run-prepared");
    await expect(store.allocate("run-prepared")).rejects.toMatchObject({ code: "EEXIST" });
    await store.transition(run.runId, RUN_STATUS.EXTRACTING);
    const files = { "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": "{\"products\":[]}", "inventory.json": "[]", "report.md": "NOT_READY" };
    const record = await store.freezePreparation(run.runId, files, [], { accepted: 0 });
    expect(record.status).toBe(RUN_STATUS.ASSETS_VALIDATED);
    expect(record.fileDigests).toMatchObject({ "report.md": digest("NOT_READY"), "products.json": digest(files["products.json"]) });
    expect(record.results["preparationStatus"]).toBe("NOT_READY");
    expect(await store.evaluateReady(run.runId)).toBe(false);
    await expect(store.writeImmutable(run.runId, "products.json", "rewrite")).rejects.toThrow("Immutable");
    const firstSource = await readFile(store.path(run.runId, "source.json"), "utf8");
    const second = await store.allocate("run-another");
    expect(second.runId).toBe("run-another");
    expect(await readFile(store.path(run.runId, "source.json"), "utf8")).toBe(firstSource);
  });
  it("leaves a mandatory-artifact publication failure non-consumable", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-partial-run-")); const store = new RunStore(root); const run = await store.allocate("run-partial");
    await store.transition(run.runId, RUN_STATUS.EXTRACTING);
    await store.writeImmutable(run.runId, "taxonomy.json", "preexisting");
    await expect(store.freezePreparation(run.runId, { "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": "{}", "inventory.json": "[]", "report.md": "report" }, [], {})).rejects.toThrow("Immutable");
    expect((await store.load(run.runId)).status).toBe(RUN_STATUS.FAILED);
    await expect(store.assertFrozen(run.runId)).rejects.toThrow("not frozen");
  });
  it("handles paginated listings and rejects unsafe reset prefixes", async () => {
    const objects: ObjectMetadata[] = [{ key: "products/a/1.webp", size: 1 }, { key: "products/b/1.webp", size: 1 }]; const storage: R2StoragePort = { list: async (_prefix, cursor) => cursor ? { objects: objects.slice(1) } : { objects: objects.slice(0, 1), nextCursor: "next" }, delete: async (keys) => { for (const key of keys) objects.splice(objects.findIndex((item) => item.key === key), 1); }, put: async ({ key, bytes }) => { objects.push({ key, size: bytes.byteLength }); }, head: async () => null };
    await expect(resetProductsPrefix(storage, { runId: "run", environment: "test", destinationFingerprint: "target", prefix: "other/", manifestSha256: "a".repeat(64) })).rejects.toThrow("products/"); await resetProductsPrefix(storage, { runId: "run", environment: "test", destinationFingerprint: "target", prefix: "products/", manifestSha256: "a".repeat(64) }); expect(await listAll(storage)).toEqual([]); await uploadExactSet(storage, [{ key: "products/a/1.webp", bytes: Uint8Array.of(1), contentType: "image/webp" }]); expect(await listAll(storage)).toHaveLength(1);
  });

  it("requires every readiness stage and records failed/recovered evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-readiness-")); const store = new RunStore(root); const run = await store.allocate("run-ready");
    const required = ["snapshotFreeze", "taxonomy", "localAssets", "r2Reset", "r2Upload", "exactSet", "categories", "manifest", "preflight"];
    expect(await store.evaluateReady(run.runId)).toBe(false);
    let current = run;
    for (const stage of required) current = await store.recordStage(run.runId, stage, "ok");
    expect(await store.evaluateReady(run.runId)).toBe(true);
    current = await store.recordStage(run.runId, "r2Upload", "failed"); expect(current.blockers).toContain("r2Upload"); expect(await store.evaluateReady(run.runId)).toBe(false);
    current = await store.recordStage(run.runId, "r2Reset", "ok"); expect(current.stages.r2Reset).toBe("ok"); expect(current.stages.r2Upload).toBe("failed");
  });

  it("claims one database target before writes and never conflates it with R2 identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-target-claim-"));
    const store = new RunStore(root);
    const run = await store.allocate("run-target-claim");
    await store.transition(run.runId, RUN_STATUS.EXTRACTING);
    await store.freezePreparation(run.runId, {
      "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]",
      "products.json": "{\"products\":[]}", "inventory.json": "[]", "report.md": "NOT_READY",
    }, [], {});
    const fingerprint = "a".repeat(64);
    await expect(store.claimTarget(run.runId, fingerprint)).resolves.toMatchObject({ targetFingerprint: fingerprint });
    await expect(store.claimTarget(run.runId, fingerprint)).resolves.toMatchObject({ targetFingerprint: fingerprint });
    await expect(store.claimTarget(run.runId, "b".repeat(64))).rejects.toThrow("different database target");
    await expect(store.claimTarget(run.runId, "not-a-fingerprint")).rejects.toThrow("fingerprint is invalid");
    expect((await store.load(run.runId)).stages).not.toHaveProperty("r2DestinationFingerprint");
  });

  it("records atomic import counts and requires exact read-only reconciliation before recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "catalog-import-receipt-"));
    const store = new RunStore(root);
    const run = await store.allocate("run-import-receipt");
    const fingerprint = "a".repeat(64);
    const manifestSha256 = "b".repeat(64);
    await store.save({ ...run, status: RUN_STATUS.READY, targetFingerprint: fingerprint, manifestSha256 });
    await store.transition(run.runId, RUN_STATUS.IMPORTING);
    const counts = { products: 3, variants: 5, images: 7, categoryLinks: 4 };
    const committed = await store.recordImportOutcome(run.runId, { targetFingerprint: fingerprint, manifestSha256, counts });
    expect(committed.status).toBe(RUN_STATUS.IMPORTED);
    expect(committed.results.import).toMatchObject({ counts, targetFingerprint: fingerprint, manifestSha256 });
    await expect(store.transition(run.runId, RUN_STATUS.IMPORTING)).rejects.toThrow("Invalid run transition");

    const interrupted = await store.allocate("run-reconcile-import");
    await store.save({ ...interrupted, status: RUN_STATUS.READY, targetFingerprint: fingerprint, manifestSha256 });
    await store.transition(interrupted.runId, RUN_STATUS.IMPORTING);
    await store.transition(interrupted.runId, RUN_STATUS.RECONCILIATION_REQUIRED);
    await expect(store.recordImportOutcome(interrupted.runId, { targetFingerprint: fingerprint, manifestSha256, counts })).rejects.toThrow("active approved run");
    await expect(store.confirmReconciledImport(interrupted.runId, { targetFingerprint: fingerprint, manifestSha256, counts, mismatches: ["IMAGE_ROWS_MISMATCH"] })).rejects.toThrow("does not match");
    expect((await store.load(interrupted.runId)).status).toBe(RUN_STATUS.RECONCILIATION_REQUIRED);
    const reconciled = await store.confirmReconciledImport(interrupted.runId, { targetFingerprint: fingerprint, manifestSha256, counts, mismatches: [] });
    expect(reconciled.status).toBe(RUN_STATUS.IMPORTED);
    expect((reconciled.results.import as { reconciled?: boolean }).reconciled).toBe(true);
  });
});
