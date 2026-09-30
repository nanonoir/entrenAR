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

  it("does not transform legacy shallow observations into fabricated variants", () => {
    const result = transformProducts([
      { url: "https://fixture.invalid/a", name: "Alpha", descriptionHtml: "", sku: "DUP-1", price: 10, images: ["a"], categories: ["performance"], variants: [{ weightGrams: 500, stock: 0, heightCm: 10, depth: 3 }] },
    ]);
    expect(result.manifest).toBeUndefined();
    expect(result.exclusions[0]?.code).toBe("MISSING_STRUCTURED_SOURCE");
  });

  it("rejects presentation-only HTML without recognized structured source state", () => {
    expect(() => parseProductHtml("https://fixture.invalid/p", '<h1>Product</h1><div data-variants="not-json"></div>')).toThrow("Malformed structured product state.");
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
