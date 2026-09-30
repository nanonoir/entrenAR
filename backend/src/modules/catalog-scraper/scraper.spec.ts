import { discoverProductUrls, extractProducts, parseProductHtml } from "./scraper";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Entreno scraper primitives", () => {
  it("deduplicates and sorts product URLs", () => {
    expect(discoverProductUrls("<loc>https://x/productos/b</loc><loc>https://x/productos/a</loc><loc>https://x/productos/a</loc>")).toEqual({
      urls: ["https://x/productos/a", "https://x/productos/b"], duplicates: 1,
    });
  });

  it("normalizes the real Tiendanube data-variants and NubeSDK shape", async () => {
    const html = await readFile(join(__dirname, "fixtures", "product.html"), "utf8");
    const result = parseProductHtml("https://x/productos/a", html);
    expect(result.name).toBe("BALBOAFIT Muñequeras Elásticas");
    expect(result.descriptionHtml).toBe("<p>Soporte y protección.</p>");
    expect(result.sourceProduct?.sourceId).toBe("341936320");
    expect(result.sourceProduct?.brand).toBe("BALBOAFIT");
    expect(result.sourceProduct?.variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "1517758997", sku: "BALBOAFIT-MUÑEQUERA-NEGRO-S", quantity: 0, options: { Color: "Negro", Talle: "S" }, imageId: "1185047815", logistics: { weightGrams: 100, heightCm: 5, widthCm: 10, lengthCm: 3 } }),
      expect.objectContaining({ id: "1517759000", sku: "BALBOAFIT-MUÑEQUERA-GRIS-S", quantity: 9, imageId: "1185049244" }),
    ]));
    expect(result.images).toEqual(["https://acdn-us.mitiendanube.com/black.webp", "https://acdn-us.mitiendanube.com/grey.webp"]);
    expect(result.categories).toEqual([]);
  });

  it("fails closed on malformed state and does not parse the SDK script as a variant", () => {
    expect(() => parseProductHtml("https://x/productos/a", '<script id="product-state">{bad}</script><script id="nube-sdk-script">sku</script>')).toThrow("Malformed structured product state.");
    expect(() => parseProductHtml("https://x/productos/a", '<script id="product-state">{"variants":[]}</script>')).toThrow("Malformed structured product state.");
  });

  it("fails closed when the initial parser probe has no valid product", async () => {
    await expect(extractProducts(["https://x/productos/a"], {
      fetcher: { request: async () => ({ status: 200, headers: new Headers(), text: async () => '<script id="product-state">{"variants":[]}</script>', arrayBuffer: async () => new ArrayBuffer(0) }) },
    })).rejects.toThrow("Malformed structured product state.");
  });

  it("isolates one malformed product after the initial probe establishes the source schema", async () => {
    const validHtml = await readFile(join(__dirname, "fixtures", "product.html"), "utf8");
    const result = await extractProducts(["https://x/productos/a", "https://x/productos/b", "https://x/productos/c", "https://x/productos/d"], {
      fetcher: { request: async (url) => ({ status: 200, headers: new Headers(), text: async () => url.endsWith("/d") ? '<div id="single-product"></div>' : validHtml, arrayBuffer: async () => new ArrayBuffer(0) }) },
    });
    expect(result.products).toHaveLength(3);
    expect(result.failures).toEqual([expect.objectContaining({ url: "https://x/productos/d", code: "SOURCE_SCHEMA_INVALID" })]);
  });

  it("accounts for isolated source failures and retains deterministic URL order", async () => {
    const validHtml = await readFile(join(__dirname, "fixtures", "product.html"), "utf8");
    const requested: string[] = [];
    const result = await extractProducts(["https://x/productos/b", "https://x/productos/a"], {
      fetcher: { request: async (url) => {
        requested.push(url);
        return { status: url.endsWith("/a") ? 404 : 200, headers: new Headers(), text: async () => validHtml, arrayBuffer: async () => new ArrayBuffer(0) };
      } },
    });
    expect(result.products.map((product) => product.url)).toEqual(["https://x/productos/b"]);
    expect(result.failures).toEqual([{ url: "https://x/productos/a", code: "SOURCE_NOT_FOUND", message: "Product source returned HTTP 404." }]);
    expect(requested).toHaveLength(2);
  });
});
