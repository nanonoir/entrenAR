import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "./run/run-store";
import { runPreflightCommand } from "./preflight.command";
import type { R2StoragePort } from "./storage/r2-storage";

async function fixture(productCount = 0, category = "performance"): Promise<{ args: string[]; storage: R2StoragePort }> {
  const root = await mkdtemp(join(tmpdir(), "preflight-command-")); const store = new RunStore(root); const run = await store.allocate("run-preflight");
  await store.transition(run.runId, RUN_STATUS.EXTRACTING);
  const manifest = JSON.stringify({ products: [{ slug: "item", name: "Item", price: 12, categorySlugs: [category], images: [{ storageKey: "products/item/1.webp", position: 1 }], variants: [{ sku: "ITEM-1", attributes: {}, stockMode: "TRACKED", quantity: 0 }], weightGrams: 100 }] });
  const assetBytes = Buffer.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
  const inventory = [{ key: "products/item/1.webp", size: assetBytes.byteLength, sha256: digest(assetBytes) }];
  let frozen = await store.freezePreparation(run.runId, { "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": manifest, "inventory.json": JSON.stringify(inventory), "report.md": "PREPARED NOT_READY" }, inventory, { accepted: 1 });
  frozen = await store.transition(run.runId, RUN_STATUS.R2_RESET, { stages: { ...frozen.stages, r2Reset: "ok" } });
  frozen = await store.transition(run.runId, RUN_STATUS.ASSETS_UPLOADED, { stages: { ...frozen.stages, r2Upload: "ok" } });
  await store.transition(run.runId, RUN_STATUS.CATEGORIES_SYNCED, { stages: { ...frozen.stages, categories: "ok" }, targetFingerprint: "a".repeat(64), r2DestinationFingerprint: "c".repeat(64) });
  await mkdir(store.path(run.runId, "assets/products/item"), { recursive: true }); await writeFile(store.path(run.runId, "assets/products/item/1.webp"), assetBytes);
  const object = { key: "products/item/1.webp", size: assetBytes.byteLength, sha256: digest(assetBytes) };
  return { args: ["--run-id", run.runId, "--environment", "test", "--destination-fingerprint", "c".repeat(64), "--manifest-sha256", digest(manifest), "--expected-count", "1", "--run-root", root, "--confirm-db-fingerprint", "a".repeat(64)], storage: { destinationFingerprint: () => "c".repeat(64), list: jest.fn().mockResolvedValue({ objects: [object] }), delete: jest.fn(), put: jest.fn(), head: jest.fn().mockResolvedValue(object) } };
}

describe("preflight command", () => {
  it("returns ready for clean canonical frozen inputs", async () => {
    const value = await fixture(); const output = jest.fn();
    const store = new RunStore(value.args[value.args.indexOf("--run-root") + 1]!);
    await expect(runPreflightCommand(value.args, { storage: value.storage, categorySlugs: new Set(["performance"]), productCount: 0, databaseFingerprint: () => "a".repeat(64), output })).resolves.toBe(0);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "PREFLIGHT_READY", blockers: [] }));
    expect((await store.load("run-preflight")).status).toBe(RUN_STATUS.READY);
  });

  it("reports non-writing blockers", async () => {
    const value = await fixture(1, "unknown"); const output = jest.fn();
    await expect(runPreflightCommand(value.args, { storage: value.storage, categorySlugs: new Set(["performance"]), productCount: 1, databaseFingerprint: () => "a".repeat(64), output })).resolves.toBe(2);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "PREFLIGHT_BLOCKED", blockers: expect.arrayContaining(["TARGET_NOT_CLEAN", "UNKNOWN_CATEGORY"]) }));
    expect(value.storage.put).not.toHaveBeenCalled(); expect(value.storage.delete).not.toHaveBeenCalled();
  });

  it("revokes stale READY evidence after a frozen manifest digest changes", async () => {
    const value = await fixture();
    const root = value.args[value.args.indexOf("--run-root") + 1]!;
    const store = new RunStore(root);
    await store.save({ ...(await store.load("run-preflight")), status: RUN_STATUS.READY });
    await writeFile(store.path("run-preflight", "products.json"), `${await readFile(store.path("run-preflight", "products.json"), "utf8")} `);
    const output = jest.fn();

    await expect(runPreflightCommand(value.args, {
      storage: value.storage,
      categorySlugs: new Set(["performance"]),
      productCount: 0,
      databaseFingerprint: () => "a".repeat(64),
      output,
    })).resolves.toBe(2);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ blockers: expect.arrayContaining(["FROZEN_FILE_DIGEST_CHANGED"]) }));
    expect((await store.load("run-preflight")).status).toBe(RUN_STATUS.CATEGORIES_SYNCED);
  });

  it("blocks extra/missing R2 objects and target mismatch without performing R2 writes", async () => {
    const value = await fixture();
    value.storage.list = jest.fn().mockResolvedValue({ objects: [{ key: "products/item/1.webp", size: 12 }, { key: "products/extra/1.webp", size: 12 }] });
    const output = jest.fn();
    await expect(runPreflightCommand(value.args, {
      storage: value.storage,
      categorySlugs: new Set(["performance"]),
      productCount: 0,
      databaseFingerprint: () => "a".repeat(64),
      output,
    })).resolves.toBe(2);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "PREFLIGHT_BLOCKED", blockers: expect.arrayContaining(["R2_EXACT_SET_FAILED"]) }));
    const targetOutput = jest.fn();
    await expect(runPreflightCommand(value.args, {
      storage: value.storage,
      categorySlugs: new Set(["performance"]),
      productCount: 0,
      databaseFingerprint: () => "b".repeat(64),
      output: targetOutput,
    })).resolves.toBe(2);
    expect(targetOutput).toHaveBeenCalledWith(expect.objectContaining({ code: "PREFLIGHT_BLOCKED", blockers: expect.arrayContaining(["TARGET_MISMATCH"]) }));
    expect(value.storage.put).not.toHaveBeenCalled();
    expect(value.storage.delete).not.toHaveBeenCalled();
  });

  it("does not grant READY when a mandatory persisted stage is missing", async () => {
    const value = await fixture();
    const store = new RunStore(value.args[value.args.indexOf("--run-root") + 1]!);
    await store.recordStage("run-preflight", "r2Upload", "failed");
    const output = jest.fn();
    await expect(runPreflightCommand(value.args, {
      storage: value.storage,
      categorySlugs: new Set(["performance"]),
      productCount: 0,
      databaseFingerprint: () => "a".repeat(64),
      output,
    })).resolves.toBe(2);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ blockers: expect.arrayContaining(["REQUIRED_STAGE_MISSING"]) }));
    expect((await store.load("run-preflight")).status).toBe(RUN_STATUS.CATEGORIES_SYNCED);
  });
});
