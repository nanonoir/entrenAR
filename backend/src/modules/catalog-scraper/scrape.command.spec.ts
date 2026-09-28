import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCatalogScrapeCommand } from "./scrape.command";

describe("catalog preparation command", () => {
  it("writes deterministic handoff files without invoking catalog:import", async () => {
    const output = await mkdtemp(join(tmpdir(), "prd2-handoff-"));
    const originalFetch = globalThis.fetch;
    const sitemap = "<loc>https://fixture.invalid/productos/a</loc>";
    globalThis.fetch = (async (input: string | URL) => new Response(String(input).endsWith("sitemap.xml") ? sitemap : '<h1>Fixture</h1><div data-variants=\'[{"sku":"FIX-1","weightGrams":100}]\'></div><div data-category="performance"></div><img src="fixture.webp">', { status: 200 })) as typeof fetch;
    try {
      await expect(runCatalogScrapeCommand("https://fixture.invalid/sitemap.xml", output)).resolves.toBe(0);
      const report = await readFile(join(output, "report.md"), "utf8");
      const products = await readFile(join(output, "products.json"), "utf8");
      expect(report).toContain("READY");
      expect(products).not.toContain("catalog:import");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
