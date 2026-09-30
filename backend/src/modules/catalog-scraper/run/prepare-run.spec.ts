import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractedProduct } from "../scraper";
import { RunStore } from "./run-store";
import { prepareRun } from "./prepare-run";

const taxonomy = {
  categories: [
    { slug: "root", name: "Root", visibility: "visible" as const, sortOrder: 1 },
    { slug: "leaf", name: "Leaf", parentSlug: "root", visibility: "visible" as const, sortOrder: 2 },
  ],
  mappings: [{ sourceCategory: "LEAF", sourceUrl: "https://fixture.invalid/leaf/", normalizedSlug: "leaf", parentSlug: "root", action: "keep" as const }],
};

function source(url: string, sku: string): ExtractedProduct {
  const sourceProduct = {
    sourceUrl: url,
    sourceId: sku,
    name: sku,
    descriptionHtml: "<p>Fixture</p>",
    categories: [{ sourceCategory: "LEAF", path: ["ROOT", "LEAF"] }],
    gallery: [{ id: `${sku}-image`, url: `https://images.invalid/${sku}.webp` }],
    variants: [{ id: `${sku}-variant`, sku, price: 100, options: {}, stockMode: "TRACKED" as const, quantity: 0, logistics: { weightGrams: 100 } }],
  };
  return { url, name: sku, descriptionHtml: sourceProduct.descriptionHtml, categories: ["LEAF"], images: sourceProduct.gallery.map((image) => image.url), variants: sourceProduct.variants, sourceProduct };
}

describe("catalog preparation run orchestration", () => {
  it("accounts for accepted, excluded, and isolated extraction-failed URLs with accepted-only inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "prepare-run-"));
    const store = new RunStore(root);
    const sitemap = ["a", "b", "c"].map((id) => `<loc>https://fixture.invalid/productos/${id}</loc>`).join("");
    const steps: string[] = [];
    let activeAssets = 0;
    let peakAssets = 0;
    const accepted = source("https://fixture.invalid/productos/a", "A");
    accepted.sourceProduct!.gallery.push(
      { id: "A-2", url: "https://images.invalid/A-2.webp" },
      { id: "A-3", url: "https://images.invalid/A-3.webp" },
      { id: "A-4", url: "https://images.invalid/A-4.webp" },
    );
    const result = await prepareRun("https://fixture.invalid/sitemap.xml", {
      store,
      fetcher: { request: async () => { steps.push("sitemap"); return { status: 200, headers: new Headers(), text: async () => sitemap, arrayBuffer: async () => new ArrayBuffer(0) }; } },
      extract: async () => { steps.push("extract"); return { products: [accepted, source("https://fixture.invalid/productos/b", "B")], failures: [{ url: "https://fixture.invalid/productos/c", code: "SOURCE_NOT_FOUND", message: "Not found" }] }; },
      loadTaxonomy: async () => { steps.push("taxonomy"); return taxonomy; },
      resolveCategoryMemberships: async () => { steps.push("category-memberships"); return new Map([["A", ["LEAF"]], ["B", ["LEAF"]]]); },
      fetchAsset: async (url) => {
        steps.push("asset");
        activeAssets += 1;
        peakAssets = Math.max(peakAssets, activeAssets);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeAssets -= 1;
        return { status: 200, headers: new Headers({ "content-type": url.includes("/B.") ? "image/png" : "image/webp" }), arrayBuffer: async () => Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]).buffer as ArrayBuffer };
      },
    });
    try {
      expect(result.status).toBe("PREPARED");
      expect(result.report.readiness).toBe("NOT_READY");
      expect(result.report.outcomes.map((entry) => entry.result)).toEqual(["ACCEPTED", "EXCLUDED", "EXTRACTION_FAILED"]);
      const run = await store.load(result.runId);
      expect(run.status).toBe("ASSETS_VALIDATED");
      expect(run.expectedObjects.map((item) => item.key)).toEqual(["products/a/1.webp", "products/a/2.webp", "products/a/3.webp", "products/a/4.webp"]);
      expect(steps.slice(0, 4)).toEqual(["sitemap", "taxonomy", "category-memberships", "extract"]);
      expect(peakAssets).toBeGreaterThan(1);
      expect(peakAssets).toBeLessThanOrEqual(3);
      const directory = store.path(result.runId, "");
      expect(await readFile(join(directory, "assets/products/a/1.webp"))).toBeTruthy();
      expect(await readFile(join(directory, "assets/products/a/4.webp"))).toBeTruthy();
      await expect(readFile(join(directory, "assets/products/b/1.webp"))).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readdir(directory)).toEqual(expect.arrayContaining(["run.json", "source.json", "taxonomy.json", "categories.json", "products.json", "inventory.json", "report.md", "assets"]));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("fails closed on unknown taxonomy drift without making the run operational", async () => {
    const root = await mkdtemp(join(tmpdir(), "prepare-drift-"));
    const store = new RunStore(root);
    const sitemap = "<loc>https://fixture.invalid/productos/a</loc>";
    const result = await prepareRun("https://fixture.invalid/sitemap.xml", {
      store,
      fetcher: { request: async () => ({ status: 200, headers: new Headers(), text: async () => sitemap, arrayBuffer: async () => new ArrayBuffer(0) }) },
      extract: async () => ({ products: [{ ...source("https://fixture.invalid/productos/a", "A"), categories: ["UNMAPPED"], sourceProduct: { ...source("https://fixture.invalid/productos/a", "A").sourceProduct!, categories: [{ sourceCategory: "UNMAPPED", path: ["UNMAPPED"] }] } }], failures: [] }),
      loadTaxonomy: async () => taxonomy,
      resolveCategoryMemberships: async () => new Map([["A", ["UNMAPPED"]]]),
    });
    try {
      expect(result.status).toBe("FAILED");
      expect((await store.load(result.runId)).status).toBe("FAILED");
      expect(result.report.readiness).toBe("NOT_READY");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("persists a redacted report and attempted URL evidence when a parser probe fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "prepare-failure-report-")); const store = new RunStore(root);
    const sitemap = ["a", "b", "c", "d"].map((id) => `<loc>https://fixture.invalid/productos/${id}</loc>`).join("");
    const result = await prepareRun("https://fixture.invalid/sitemap.xml", {
      store,
      fetcher: { request: async (url) => ({ status: 200, headers: new Headers(), text: async () => url.endsWith("sitemap.xml") ? sitemap : '<div id="single-product"></div>', arrayBuffer: async () => new ArrayBuffer(0) }) },
      loadTaxonomy: async () => taxonomy,
      resolveCategoryMemberships: async () => new Map(),
    });
    try {
      expect(result.status).toBe("FAILED");
      expect(await readFile(store.path(result.runId, "report.md"), "utf8")).toContain("SYSTEMIC_SOURCE_SCHEMA_FAILURE");
      const record = await store.load(result.runId);
      expect(record.counts).toMatchObject({ discovered: 4, extractionFailed: 3, notAttempted: 1 });
      expect(record.results["failure"]).toMatchObject({ code: "SOURCE_SCHEMA_INVALID", sourceUrls: expect.any(Array) });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
