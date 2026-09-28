import { fetchWithRetry, parseProductHtml } from "./scraper";
import { transformProducts } from "./transformer";
import { uploadValidatedGalleryImage, validateWebp, type AssetStoragePort } from "./asset-storage";
import { createPipelineReport, renderReport } from "./report";

function response(status: number, body = ""): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

describe("PRD2 preparation behavioral coverage", () => {
  it("does not retry permanent 4xx responses", async () => {
    let calls = 0;
    await expect(fetchWithRetry("https://fixture.invalid/missing", {
      fetcher: { request: async () => { calls += 1; return response(404); } },
    })).resolves.toMatchObject({ status: 404 });
    expect(calls).toBe(1);
  });

  it("retries 429 and succeeds, while timing out through the abort signal", async () => {
    let calls = 0;
    await expect(fetchWithRetry("https://fixture.invalid/retry", {
      fetcher: { request: async () => { calls += 1; return calls < 3 ? response(429) : response(200, "ok"); } },
    })).resolves.toMatchObject({ status: 200 });
    expect(calls).toBe(3);
    await expect(fetchWithRetry("https://fixture.invalid/timeout", {
      timeoutMs: 1,
      attempts: 1,
      fetcher: { request: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }) },
    })).rejects.toThrow("aborted");
  });

  it("excludes duplicate SKUs and missing weights while retaining zero stock", () => {
    const result = transformProducts([
      { url: "https://fixture.invalid/a", name: "Alpha", descriptionHtml: "", sku: "DUP-1", price: 10, images: ["a"], categories: ["performance"], variants: [{ weightGrams: 500, stock: 0, heightCm: 10, depth: 3 }] },
      { url: "https://fixture.invalid/b", name: "Beta", descriptionHtml: "", sku: "DUP-1", price: 10, images: ["b"], categories: ["performance"], variants: [{ weightGrams: 500 }] },
      { url: "https://fixture.invalid/c", name: "Gamma", descriptionHtml: "", sku: "GAM-1", price: 10, images: ["c"], categories: ["performance"], variants: [{ weightGrams: 0 }] },
    ]);
    expect(result.manifest?.products[0]?.variants[0]?.quantity).toBe(0);
    expect(result.exclusions.map((item) => item.code)).toEqual(["DUPLICATE_SKU", "MISSING_WEIGHT"]);
    expect(result.warnings).toContain("Missing dimensions: alpha");
  });

  it("maps depth to length and rejects malformed embedded variant data", () => {
    const product = parseProductHtml("https://fixture.invalid/p", '<h1>Product</h1><div data-variants="[{&quot;sku&quot;:&quot;P-1&quot;,&quot;weightGrams&quot;:100}]"></div>');
    expect(product.variants).toEqual([{ sku: "P-1", weightGrams: 100 }]);
    expect(() => parseProductHtml("https://fixture.invalid/p", '<div data-variants="not-json"></div>')).toThrow("Malformed variant data");
    const transformed = transformProducts([{ ...product, sku: "P-1", price: 20, images: ["image"], categories: ["performance"], variants: [{ weightGrams: 100, depth: 8 }] }]);
    expect(transformed.manifest?.products[0]?.lengthCm).toBe(8);
  });

  it("accepts RIFF/WEBP bytes only and renders secret-safe readiness reports", async () => {
    const bytes = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
    await expect(validateWebp(bytes, "image/webp")).resolves.toBe(true);
    await expect(validateWebp(new Uint8Array(Buffer.from("not-an-image")), "image/webp")).resolves.toBe(false);
    const report = createPipelineReport();
    report.blockers.push("R2 preflight failed");
    report.warnings.push("secret-token must not appear");
    const rendered = renderReport(report);
    expect(rendered).toContain("NOT_READY");
    expect(rendered).not.toContain("R2_ACCESS_KEY_ID");
    expect(rendered).not.toContain("secret-token");
  });

  it("overwrites canonical gallery keys and blocks invalid assets", async () => {
    const uploads: string[] = [];
    const storage: AssetStoragePort = {
      put: async ({ key }) => { uploads.push(key); },
      exists: async () => true,
      delete: async () => undefined,
      get: async () => new Uint8Array(),
    };
    const bytes = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
    const response = { status: 200, contentType: "image/webp", arrayBuffer: async () => bytes.buffer };
    await expect(uploadValidatedGalleryImage(storage, "fixture", 1, response)).resolves.toBe("products/fixture/1.webp");
    await expect(uploadValidatedGalleryImage(storage, "fixture", 1, response)).resolves.toBe("products/fixture/1.webp");
    expect(uploads).toEqual(["products/fixture/1.webp", "products/fixture/1.webp"]);
    await expect(uploadValidatedGalleryImage(storage, "fixture", 2, { ...response, status: 404 })).rejects.toThrow("INVALID_IMAGE_ASSET");
  });
});
