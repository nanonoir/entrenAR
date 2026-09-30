import { mkdtemp, mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseOperationalArgs } from "./run-binding";
import { digest, RunStore, RUN_STATUS } from "../run/run-store";

async function fixture(): Promise<{ args: string[]; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "binding-")); const store = new RunStore(root); const run = await store.allocate("run-binding");
  await store.transition(run.runId, RUN_STATUS.EXTRACTING);
  const manifest = JSON.stringify({ products: [{ slug: "item", name: "Item", price: 12, categorySlugs: ["category"], images: [{ storageKey: "products/item/1.webp", position: 1 }], variants: [{ sku: "ITEM-1", attributes: {}, stockMode: "TRACKED", quantity: 0 }], weightGrams: 100 }] });
  const assetBytes = Buffer.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
  const inventory = [{ key: "products/item/1.webp", size: assetBytes.byteLength, sha256: digest(assetBytes) }];
  const frozen = await store.freezePreparation(run.runId, {
    "source.json": "{}", "taxonomy.json": "[]", "categories.json": "[]", "products.json": manifest,
    "inventory.json": JSON.stringify(inventory), "report.md": "PREPARED NOT_READY",
  }, inventory, { accepted: 1 });
  await store.save({ ...frozen, targetFingerprint: "database-target-claim", r2DestinationFingerprint: "r2-target" });
  await mkdir(store.path(run.runId, "assets/products/item"), { recursive: true });
  await writeFile(store.path(run.runId, "assets/products/item/1.webp"), assetBytes);
  return { root, args: ["--run-id", run.runId, "--environment", "test", "--destination-fingerprint", "r2-target", "--manifest-sha256", digest(manifest), "--expected-count", "1", "--run-root", root] };
}

describe("operational binding parser", () => {
  it("rejects duplicate and positional arguments before I/O", async () => {
    await expect(parseOperationalArgs(["--run-id", "one", "--run-id", "two"])).rejects.toThrow("Duplicate");
    await expect(parseOperationalArgs(["value"])).rejects.toThrow("named flags");
  });

  it("binds the selected frozen run and rejects missing or mismatched confirmations", async () => {
    const value = await fixture();
    await expect(parseOperationalArgs(value.args)).resolves.toMatchObject({ runId: "run-binding", expectedCount: 1 });
    await expect(parseOperationalArgs(value.args.filter((item) => item !== "--expected-count" && item !== "1"))).rejects.toThrow("Missing");
    await expect(parseOperationalArgs(value.args.map((item) => item === "r2-target" ? "other" : item))).rejects.toThrow("R2 destination fingerprint does not match selected run.");
    await expect(parseOperationalArgs(value.args)).resolves.toMatchObject({ run: { targetFingerprint: "database-target-claim" }, destinationFingerprint: "r2-target" });
  });

  it("rejects fixture inputs and symlinked frozen files", async () => {
    const value = await fixture();
    const fixtureArgs = [...value.args];
    await expect(parseOperationalArgs(fixtureArgs)).resolves.toBeTruthy();
  const store = new RunStore(value.root); const run = await store.load("run-binding"); await store.save({ ...run, results: { ...run.results, fixture: true } });
    await expect(parseOperationalArgs(fixtureArgs)).rejects.toThrow("Fixture");
    const second = await fixture(); const secondStore = new RunStore(second.root); const target = join(second.root, "outside-products.json"); await writeFile(target, "manifest"); await unlink(secondStore.path("run-binding", "products.json"));
    try { await symlink(target, secondStore.path("run-binding", "products.json")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EPERM") return; throw error; }
    await expect(parseOperationalArgs(second.args)).rejects.toThrow("Symlink");
  });

  it("rejects partial preparation stages and failed runs", async () => {
    const value = await fixture();
    const store = new RunStore(value.root);
    await store.recordStage("run-binding", "taxonomy", "failed");
    await expect(parseOperationalArgs(value.args)).rejects.toThrow("Preparation stage is missing: taxonomy");
    const second = await fixture();
    const failedStore = new RunStore(second.root);
    await failedStore.transition("run-binding", RUN_STATUS.FAILED);
    await expect(parseOperationalArgs(second.args)).rejects.toThrow("incomplete or not eligible");
  });
});
