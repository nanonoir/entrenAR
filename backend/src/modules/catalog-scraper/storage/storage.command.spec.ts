import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "../run/run-store";
import { runStorageCommand } from "./storage.command";
import type { R2StoragePort } from "./r2-storage";

async function createBindingRoot(): Promise<{ root: string; args: string[] }> {
  const r2Fingerprint = "c".repeat(64);
  const root = await mkdtemp(join(tmpdir(), "storage-command-")); const store = new RunStore(root); const run = await store.allocate("run-storage");
  await store.transition(run.runId, RUN_STATUS.EXTRACTING);
  const manifest = JSON.stringify({ products: [{ slug: "item", name: "Item", price: 12, categorySlugs: ["category"], images: [{ storageKey: "products/item/1.webp", position: 1 }], variants: [{ sku: "ITEM-1", attributes: {}, stockMode: "TRACKED", quantity: 0 }], weightGrams: 100 }] });
  const assetBytes = Buffer.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
  const inventory = [{ key: "products/item/1.webp", size: assetBytes.byteLength, sha256: digest(assetBytes) }];
  const frozen = await store.freezePreparation(run.runId, { "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": manifest, "inventory.json": JSON.stringify(inventory), "report.md": "PREPARED NOT_READY" }, inventory, { accepted: 1 });
  await store.save({ ...frozen, targetFingerprint: "target" });
  await mkdir(store.path(run.runId, "assets/products/item"), { recursive: true }); await writeFile(store.path(run.runId, "assets/products/item/1.webp"), assetBytes);
  return { root, args: ["--run-id", run.runId, "--environment", "test", "--destination-fingerprint", r2Fingerprint, "--manifest-sha256", digest(manifest), "--expected-count", "1", "--run-root", root, "--prefix", "products/"] };
}

const emptyStorage = (): R2StoragePort => {
  let objects = [{ key: "products/item/1.webp", size: 12 }];
  return {
    destinationFingerprint: () => "c".repeat(64),
    list: jest.fn().mockImplementation(async () => ({ objects })),
    delete: jest.fn().mockImplementation(async () => { objects = []; }),
    put: jest.fn(),
    head: jest.fn(),
  };
};

describe("storage command boundary", () => {
  it("dispatches a bound reset and emits only safe output", async () => {
    const fixture = await createBindingRoot(); const output = jest.fn();
    await expect(runStorageCommand("reset", fixture.args, { storage: emptyStorage(), output })).resolves.toBe(0);
    expect(output).toHaveBeenCalledWith({ ok: true, code: "R2_RESET", runId: "run-storage", expectedCount: 1 });
  });

  it("resets an empty first-load prefix even when the new run has assets", async () => {
    const fixture = await createBindingRoot(); const output = jest.fn();
    const storage = emptyStorage(); storage.list = jest.fn().mockResolvedValue({ objects: [] });
    await expect(runStorageCommand("reset", fixture.args, { storage, output })).resolves.toBe(0);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith({ ok: true, code: "R2_RESET", runId: "run-storage", expectedCount: 1 });
  });

  it("rejects a confirmation for a different configured R2 destination", async () => {
    const fixture = await createBindingRoot(); const output = jest.fn(); const storage = emptyStorage();
    storage.destinationFingerprint = () => "d".repeat(64);
    await expect(runStorageCommand("reset", fixture.args, { storage, output })).resolves.toBe(2);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith({ ok: false, code: "OPERATIONAL_COMMAND_FAILED" });
  });

  it("rejects prefix escape and redacts adapter errors", async () => {
    const fixture = await createBindingRoot(); const output = jest.fn();
    await expect(runStorageCommand("reset", fixture.args.map((value, index) => index === fixture.args.length - 1 ? "other/" : value), { storage: emptyStorage(), output })).resolves.toBe(2);
    expect(output).toHaveBeenLastCalledWith({ ok: false, code: "OPERATIONAL_COMMAND_FAILED" });
    const failing = emptyStorage(); failing.list = jest.fn().mockRejectedValue(new Error("secret endpoint https://secret.example"));
    await expect(runStorageCommand("reset", fixture.args, { storage: failing, output })).resolves.toBe(2);
    expect(JSON.stringify(output.mock.calls.at(-1))).not.toContain("secret.example");
  });

  it("reconstructs prior storage stages only after read-only exact-set verification", async () => {
    const fixture = await createBindingRoot();
    const store = new RunStore(fixture.root);
    const before = await store.load("run-storage");
    const inventory = JSON.parse(await readFile(store.path("run-storage", "inventory.json"), "utf8")) as Array<{ key: string; size: number; sha256: string }>;
    const object = inventory[0]!;
    const storage: R2StoragePort = {
      destinationFingerprint: () => "c".repeat(64),
      list: jest.fn().mockResolvedValue({ objects: [{ key: object.key, size: object.size }] }),
      head: jest.fn().mockImplementation(async (_key: string, publicRequest?: boolean) => publicRequest ? { key: object.key, size: object.size } : object),
      put: jest.fn(),
      delete: jest.fn(),
    };
    const output = jest.fn();

    await expect(runStorageCommand("reconcile", fixture.args, { storage, output })).resolves.toBe(0);
    const after = await store.load("run-storage");
    expect(after.runId).toBe(before.runId);
    expect(after.fileDigests).toEqual(before.fileDigests);
    expect(after.stages).toMatchObject({ r2Reset: "ok", r2Upload: "ok" });
    expect(after.status).toBe(RUN_STATUS.ASSETS_UPLOADED);
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "R2_RECONCILED" }));
  });

  it("revokes READY after read-only reconciliation detects missing objects", async () => {
    const fixture = await createBindingRoot();
    const store = new RunStore(fixture.root);
    const ready = await store.load("run-storage");
    await store.save({
      ...ready,
      status: RUN_STATUS.READY,
      r2DestinationFingerprint: "c".repeat(64),
      stages: { ...ready.stages, categories: "ok", r2Reset: "ok", r2Upload: "ok", preflight: "ok" },
    });
    const storage: R2StoragePort = {
      destinationFingerprint: () => "c".repeat(64),
      list: jest.fn().mockResolvedValue({ objects: [] }),
      head: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    await expect(runStorageCommand("reconcile", fixture.args, { storage })).resolves.toBe(2);
    const after = await store.load("run-storage");
    expect(after.status).toBe(RUN_STATUS.CATEGORIES_SYNCED);
    expect(after.stages.preflight).toBe("failed");
    expect(after.blockers).toContain("R2_RECONCILIATION_FAILED");
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
