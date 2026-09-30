import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertExactLocalAssetSet, stageProductGallery, type LocalAssetFetcher } from "./local-assets";
import type { CatalogImportManifest } from "../../catalog-import/manifest-validator";

const validWebp = Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("local product gallery staging", () => {
  it("promotes complete galleries in source order with accepted inventory only", async () => {
    const root = await mkdtemp(join(tmpdir(), "entrenar-assets-"));
    const urls: string[] = [];
    const fetcher: LocalAssetFetcher = async (url) => {
      urls.push(url);
      return { status: 200, headers: new Headers({ "content-type": "image/webp" }), arrayBuffer: async () => validWebp.buffer as ArrayBuffer };
    };
    try {
      const inventory = await stageProductGallery(root, "alpha", [
        { id: "first", url: "https://images.invalid/1.webp" },
        { id: "second", url: "https://images.invalid/2.webp" },
      ], fetcher);
      expect(urls).toEqual(["https://images.invalid/1.webp", "https://images.invalid/2.webp"]);
      expect(inventory.map((item) => item.key)).toEqual(["products/alpha/1.webp", "products/alpha/2.webp"]);
      expect(await readFile(join(root, "assets/products/alpha/1.webp"))).toEqual(Buffer.from(validWebp));
      const manifest: CatalogImportManifest = { products: [{ slug: "alpha", name: "Alpha", price: 10, variantProperties: [], categorySlugs: ["approved"], images: [{ storageKey: "products/alpha/1.webp", position: 1 }, { storageKey: "products/alpha/2.webp", position: 2 }], variants: [{ sku: "A-1", attributes: {}, stockMode: "TRACKED", quantity: 1 }], tags: [], shippingRequired: true, weightGrams: 100 }] };
      await expect(assertExactLocalAssetSet(root, manifest, inventory)).resolves.toBeUndefined();
      await expect(assertExactLocalAssetSet(root, manifest, inventory.slice(1))).rejects.toThrow("Manifest and local asset inventory differ.");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rolls back the whole product gallery when a later selected image fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "entrenar-assets-"));
    const fetcher: LocalAssetFetcher = async (url) => ({
      status: url.endsWith("bad.webp") ? 200 : 200,
      headers: new Headers({ "content-type": url.endsWith("bad.webp") ? "image/png" : "image/webp" }),
      arrayBuffer: async () => validWebp.buffer as ArrayBuffer,
    });
    try {
      await expect(stageProductGallery(root, "rejected", [
        { id: "first", url: "https://images.invalid/good.webp" },
        { id: "second", url: "https://images.invalid/bad.webp" },
      ], fetcher)).rejects.toThrow("INVALID_IMAGE_ASSET");
      await expect(readdir(join(root, "assets", "products", "rejected"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects non-200 responses, invalid RIFF signatures, and oversized bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "entrenar-assets-"));
    const makeFetcher = (status: number, contentType: string, bytes: Uint8Array): LocalAssetFetcher => async () => ({ status, headers: new Headers({ "content-type": contentType }), arrayBuffer: async () => bytes.buffer as ArrayBuffer });
    try {
      await expect(stageProductGallery(root, "status", [{ id: "one", url: "https://images.invalid/404.webp" }], makeFetcher(404, "image/webp", validWebp))).rejects.toThrow("INVALID_IMAGE_ASSET");
      await expect(stageProductGallery(root, "signature", [{ id: "one", url: "https://images.invalid/bad.webp" }], makeFetcher(200, "image/webp", Uint8Array.from(Buffer.from("not-webp"))))).rejects.toThrow("INVALID_IMAGE_ASSET");
      await expect(stageProductGallery(root, "size", [{ id: "one", url: "https://images.invalid/large.webp" }], makeFetcher(200, "image/webp", new Uint8Array(10 * 1024 * 1024 + 1)))).rejects.toThrow("INVALID_IMAGE_ASSET");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("removes only the failed product's asset directory on duplicate staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "entrenar-assets-"));
    const fetcher: LocalAssetFetcher = async () => ({ status: 200, headers: new Headers({ "content-type": "image/webp" }), arrayBuffer: async () => validWebp.buffer as ArrayBuffer });
    try {
      await stageProductGallery(root, "same", [{ id: "one", url: "https://images.invalid/one.webp" }], fetcher);
      await expect(stageProductGallery(root, "same", [{ id: "one", url: "https://images.invalid/one.webp" }], fetcher)).rejects.toMatchObject({ code: "EEXIST" });
      await expect(readFile(join(root, "assets/products/same/1.webp"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
