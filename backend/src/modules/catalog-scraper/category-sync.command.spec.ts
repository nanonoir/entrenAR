import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RUN_STATUS, RunStore } from "./run/run-store";
import { runBoundCategorySync } from "./category-sync.command";

async function fixture(): Promise<{ runId: string; root: string; store: RunStore; fingerprint: string }> {
  const root = await mkdtemp(join(tmpdir(), "category-sync-command-"));
  const store = new RunStore(root);
  const allocated = await store.allocate("run-category-sync");
  await store.transition(allocated.runId, RUN_STATUS.EXTRACTING);
  await store.freezePreparation(allocated.runId, {
    "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]",
    "products.json": "{\"products\":[]}", "inventory.json": "[]", "report.md": "NOT_READY",
  }, [], {});
  await store.recordVerifiedStorage(allocated.runId, 0, "c".repeat(64));
  return { runId: allocated.runId, root, store, fingerprint: "a".repeat(64) };
}

describe("run-bound category synchronization", () => {
  it("uses the raw categories digest, claims one DB target, and records sync counts", async () => {
    const value = await fixture();
    const sync = jest.fn().mockResolvedValue({ created: 1, updated: 2, unchanged: 3 });
    await expect(runBoundCategorySync(value.runId, value.root, value.fingerprint, {
      databaseFingerprint: () => value.fingerprint,
      sync,
    })).resolves.toEqual({ created: 1, updated: 2, unchanged: 3, conflicts: 0 });
    const persisted = await value.store.load(value.runId);
    expect(persisted.status).toBe(RUN_STATUS.CATEGORIES_SYNCED);
    expect(persisted.targetFingerprint).toBe(value.fingerprint);
    expect(persisted.stages.categories).toBe("ok");
    expect(persisted.results.categorySync).toEqual({ created: 1, updated: 2, unchanged: 3, conflicts: 0 });
    await expect(runBoundCategorySync(value.runId, value.root, value.fingerprint, {
      databaseFingerprint: () => value.fingerprint,
      sync: jest.fn().mockResolvedValue({ created: 0, updated: 0, unchanged: 6 }),
    })).resolves.toMatchObject({ unchanged: 6 });
  });

  it("rejects changed category bytes and a changed DB target before mutation", async () => {
    const changed = await fixture();
    await writeFile(changed.store.path(changed.runId, "categories.json"), "[] ");
    const digestSync = jest.fn();
    await expect(runBoundCategorySync(changed.runId, changed.root, changed.fingerprint, {
      databaseFingerprint: () => changed.fingerprint,
      sync: digestSync,
    })).rejects.toThrow("categories digest");
    expect(digestSync).not.toHaveBeenCalled();

    const switched = await fixture();
    const sync = jest.fn();
    const fingerprints = [switched.fingerprint, "b".repeat(64)];
    await expect(runBoundCategorySync(switched.runId, switched.root, switched.fingerprint, {
      databaseFingerprint: () => fingerprints.shift() ?? "b".repeat(64),
      sync,
    })).rejects.toThrow("changed before synchronization");
    expect(sync).not.toHaveBeenCalled();
    expect((await switched.store.load(switched.runId)).targetFingerprint).toBe(switched.fingerprint);
  });

  it("rejects a run already claimed by a different database", async () => {
    const value = await fixture();
    await value.store.claimTarget(value.runId, "b".repeat(64));
    const sync = jest.fn();
    await expect(runBoundCategorySync(value.runId, value.root, value.fingerprint, {
      databaseFingerprint: () => value.fingerprint,
      sync,
    })).rejects.toThrow("different database target");
    expect(sync).not.toHaveBeenCalled();
  });

  it("records a failed sync as non-ready and keeps it safe to retry", async () => {
    const value = await fixture();
    const sync = jest.fn().mockRejectedValue(new Error("taxonomy conflict"));
    await expect(runBoundCategorySync(value.runId, value.root, value.fingerprint, {
      databaseFingerprint: () => value.fingerprint,
      sync,
    })).rejects.toThrow("taxonomy conflict");
    const failed = await value.store.load(value.runId);
    expect(failed.status).toBe(RUN_STATUS.ASSETS_UPLOADED);
    expect(failed.stages.categories).toBe("failed");
    expect(failed.blockers).toContain("CATEGORY_SYNC_FAILED");
    expect(await value.store.evaluateReady(value.runId)).toBe(false);
  });
});
