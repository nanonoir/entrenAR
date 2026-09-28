import { discoverProductUrls, parseProductHtml } from "./scraper";

describe("Entreno scraper primitives", () => {
  it("deduplicates and sorts product URLs", () => {
    expect(discoverProductUrls("<loc>https://x/productos/b</loc><loc>https://x/productos/a</loc><loc>https://x/productos/a</loc>")).toEqual({
      urls: ["https://x/productos/a", "https://x/productos/b"], duplicates: 1,
    });
  });

  it("parses embedded variant data without a browser", () => {
    const result = parseProductHtml("https://x/productos/a", '<h1>Producto</h1><div data-variants="[{&quot;sku&quot;:&quot;A-1&quot;}]"></div>');
    expect(result.name).toBe("Producto");
    expect(result.variants).toEqual([{ sku: "A-1" }]);
  });
});
