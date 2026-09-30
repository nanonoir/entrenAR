import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "./run/run-store";
import { runOperationalHandoff } from "./handoff.command";

async function handoffFixture(fixture = false): Promise<string[]> {
  const root = await mkdtemp(join(tmpdir(), "handoff-command-")); const store = new RunStore(root); const run = await store.allocate("run-handoff");
  await store.transition(run.runId, RUN_STATUS.EXTRACTING);
  const manifest = JSON.stringify({ products: [{ slug: "item", name: "Item", price: 12, categorySlugs: ["category"], images: [{ storageKey: "products/item/1.webp", position: 1 }], variants: [{ sku: "ITEM-1", attributes: {}, stockMode: "TRACKED", quantity: 0 }], weightGrams: 100 }] });
  const assetBytes = Buffer.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
  const inventory = [{ key: "products/item/1.webp", size: assetBytes.byteLength, sha256: digest(assetBytes) }];
  const frozen = await store.freezePreparation(run.runId, { "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": manifest, "inventory.json": JSON.stringify(inventory), "report.md": "PREPARED NOT_READY" }, inventory, { accepted: 1 });
  await store.save({ ...frozen, targetFingerprint: "a".repeat(64), ...(fixture ? { results: { ...frozen.results, fixture: true } } : {}) });
  await mkdir(store.path(run.runId, "assets/products/item"), { recursive: true }); await writeFile(store.path(run.runId, "assets/products/item/1.webp"), assetBytes);
  return ["--run-id", run.runId, "--environment", "test", "--destination-fingerprint", "r2-target", "--manifest-sha256", digest(manifest), "--expected-count", "1", "--run-root", root, "--confirm-db-fingerprint", "a".repeat(64)];
}

describe("operational handoff", () => {
  it("syncs only the selected frozen run", async () => {
    const output = jest.fn(); const sync = jest.fn().mockResolvedValue({ created: 1, updated: 0, unchanged: 0 });
    const args = await handoffFixture();
    await expect(runOperationalHandoff(args, { sync, databaseFingerprint: () => "a".repeat(64), output })).resolves.toBe(0);
    expect(sync).toHaveBeenCalledWith("run-handoff", expect.any(String), "a".repeat(64)); expect(output).toHaveBeenCalledWith(expect.objectContaining({ code: "CATEGORIES_SYNCED" }));
  });

  it("rejects fixture-only sources before sync", async () => {
    const sync = jest.fn(); const output = jest.fn();
    await expect(runOperationalHandoff(await handoffFixture(true), { sync, databaseFingerprint: () => "a".repeat(64), output })).resolves.toBe(2);
    expect(sync).not.toHaveBeenCalled(); expect(output).toHaveBeenCalledWith({ ok: false, code: "OPERATIONAL_COMMAND_FAILED" });
  });

  it("rejects a database target changed after operator confirmation before sync", async () => {
    const sync = jest.fn(); const output = jest.fn();
    await expect(runOperationalHandoff(await handoffFixture(), { sync, databaseFingerprint: () => "b".repeat(64), output })).resolves.toBe(2);
    expect(sync).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith({ ok: false, code: "OPERATIONAL_COMMAND_FAILED" });
  });

  it("rejects edited frozen categories before invoking sync", async () => {
    const args = await handoffFixture();
    const rootIndex = args.indexOf("--run-root");
    const root = args[rootIndex + 1]!;
    await writeFile(join(root, "run-handoff", "categories.json"), "[] ");
    const sync = jest.fn();
    await expect(runOperationalHandoff(args, { sync, databaseFingerprint: () => "a".repeat(64) })).resolves.toBe(2);
    expect(sync).not.toHaveBeenCalled();
  });
});
