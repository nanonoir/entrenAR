import "reflect-metadata";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { runPreflightCommand } from "./preflight.command";
import { runOperationalHandoff } from "./handoff.command";
import { runStorageCommand } from "./storage/storage.command";
import { localAssetPath } from "./storage/local-assets";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareRun } from "./run/prepare-run";
import { RunStore } from "./run/run-store";
import { parseOperationalArgs } from "./operations/run-binding";
import type { SourceProduct } from "./source-data/tiendanube-product";
import type { ExtractedProduct } from "./scraper";

describe("compiled operational dispatch seams", () => {
  it("keeps command boundaries injectable and does not invoke import or live adapters", async () => {
    const output = jest.fn(); const storage = { list: jest.fn().mockResolvedValue({ objects: [] }), delete: jest.fn(), put: jest.fn(), head: jest.fn() };
    await expect(runStorageCommand("reset", [], { storage, output })).resolves.toBe(2);
    await expect(runOperationalHandoff([], { sync: jest.fn(), output })).resolves.toBe(2);
    await expect(runPreflightCommand([], { storage, categorySlugs: new Set(), productCount: 0, output })).resolves.toBe(2);
    expect(storage.put).not.toHaveBeenCalled(); expect(storage.delete).not.toHaveBeenCalled(); expect(output).not.toHaveBeenCalledWith(expect.objectContaining({ code: "CATALOG_IMPORTED" }));
  });

  it("aligns local upload reads with assets/products/{slug}/{position}.webp without invoking R2", () => {
    const root = join(tmpdir(), "run", "assets");
    expect(localAssetPath(root, "products/item/1.webp")).toBe(join(root, "products", "item", "1.webp"));
    expect(() => localAssetPath("/temporary/run/assets", "../private.webp")).toThrow("Noncanonical local asset key");
  });

  it("binds a complete mocked preparation locally without invoking storage or database ports", async () => {
    const root = await mkdtemp(join(tmpdir(), "handoff-local-run-"));
    const store = new RunStore(root);
    const url = "https://fixture.invalid/productos/item";
    const state: SourceProduct = {
      sourceUrl: url, sourceId: "item", name: "Item", descriptionHtml: "<p>Fixture</p>",
      categories: [{ sourceCategory: "LEAF", path: ["ROOT", "LEAF"] }],
      gallery: [{ id: "image", url: "https://images.invalid/item.webp" }],
      variants: [{ id: "variant", sku: "ITEM-1", price: 100, options: {}, stockMode: "TRACKED", quantity: 0, logistics: { weightGrams: 100 } }],
    };
    const product: ExtractedProduct = { url, name: "Item", descriptionHtml: state.descriptionHtml, categories: ["LEAF"], images: [state.gallery[0]!.url], variants: state.variants, sourceProduct: state };
    const bytes = Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
    try {
      const prepared = await prepareRun("https://fixture.invalid/sitemap.xml", {
        store,
        fetcher: { request: async () => ({ status: 200, headers: new Headers(), text: async () => `<loc>${url}</loc>`, arrayBuffer: async () => new ArrayBuffer(0) }) },
        extract: async () => ({ products: [product], failures: [] }),
        loadTaxonomy: async () => ({
          categories: [{ slug: "root", name: "Root", visibility: "visible", sortOrder: 1 }, { slug: "leaf", name: "Leaf", parentSlug: "root", visibility: "visible", sortOrder: 2 }],
          mappings: [{ sourceCategory: "LEAF", sourceUrl: null, normalizedSlug: "leaf", parentSlug: "root", action: "keep" }],
        }),
        resolveCategoryMemberships: async () => new Map([["item", ["LEAF"]]]),
        fetchAsset: async () => ({ status: 200, headers: new Headers({ "content-type": "image/webp" }), arrayBuffer: async () => bytes.buffer as ArrayBuffer }),
      });
      const run = await store.load(prepared.runId);
      const binding = await parseOperationalArgs([
        "--run-id", prepared.runId, "--environment", "test", "--destination-fingerprint", "fixture",
        "--manifest-sha256", run.manifestSha256!, "--expected-count", "1", "--run-root", root,
      ]);
      expect(prepared.status).toBe("PREPARED");
      expect(run.results["preparationStatus"]).toBe("NOT_READY");
      expect(await readFile(localAssetPath(binding.assetsRoot, "products/item/1.webp"))).toEqual(Buffer.from(bytes));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
