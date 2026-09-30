import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCatalogScrapeCommand } from "./scrape.command";

describe("catalog preparation command", () => {
  it("writes a run-scoped immutable preparation and remains NOT_READY", async () => {
    const output = await mkdtemp(join(tmpdir(), "prd2-handoff-"));
    const originalFetch = globalThis.fetch;
    const sitemap = "<loc>https://fixture.invalid/productos/a</loc>";
    const productHtml = await readFile(join(__dirname, "fixtures", "product.html"), "utf8");
    const webp = Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP")]);
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("sitemap.xml")) return new Response(sitemap, { status: 200 });
      if (url.includes("/page/1/?results_only=true")) {
        const ids = url.includes("whey-protein") ? '<div data-product-id="341936320"></div>' : "";
        return new Response(JSON.stringify({ html: ids }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("black.webp") || url.endsWith("grey.webp")) return new Response(webp, { status: 200, headers: { "content-type": "image/webp" } });
      if (url.includes("/productos/a")) return new Response(productHtml, { status: 200 });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    try {
      await expect(runCatalogScrapeCommand("https://fixture.invalid/sitemap.xml", output)).resolves.toBe(0);
      const [runId] = await readdir(output);
      expect(runId).toMatch(/^run-/);
      const runDirectory = join(output, runId!);
      const report = await readFile(join(runDirectory, "report.md"), "utf8");
      const products = await readFile(join(runDirectory, "products.json"), "utf8");
      expect(report).toContain("NOT_READY");
      expect(products).not.toContain("catalog:import");
      expect(products).toContain('"sku": "BALBOAFIT-MUÑEQUERA-NEGRO-S"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
