import { transformProducts, type TransformTaxonomy } from "./transformer";
import type { ExtractedProduct } from "./scraper";
import type { SourceProduct } from "./source-data/tiendanube-product";

const taxonomy: TransformTaxonomy = {
  categories: [
    { slug: "suplementos", name: "Suplementos", visibility: "visible", sortOrder: 1 },
    { slug: "proteinas", name: "Proteínas", parentSlug: "suplementos", visibility: "visible", sortOrder: 2 },
  ],
  mappings: [{ sourceCategory: "PROTEINAS", sourceUrl: null, normalizedSlug: "proteinas", parentSlug: "suplementos", action: "keep" }],
};

function product(name: string, sourceId: string, variants: SourceProduct["variants"] = [{ id: `${sourceId}-variant`, sku: `${sourceId}-SKU`, price: 1250, options: { Sabor: "Cookies & Cream" }, stockMode: "TRACKED", quantity: 0, imageId: `${sourceId}-image`, logistics: { weightGrams: 500, heightCm: 10, widthCm: 5, lengthCm: 4 } }]): ExtractedProduct {
  const sourceProduct = {
    sourceUrl: `https://fixture.invalid/productos/${sourceId}`,
    sourceId,
    name,
    descriptionHtml: "<p>Product</p>",
    categories: [{ sourceCategory: "PROTEINAS", path: ["SUPLEMENTOS", "PROTEINAS"] }],
    gallery: [{ id: `${sourceId}-image`, url: `https://images.invalid/${sourceId}.webp` }],
    variants,
  };
  return { url: sourceProduct.sourceUrl, name, descriptionHtml: sourceProduct.descriptionHtml, images: sourceProduct.gallery.map((image) => image.url), categories: ["PROTEINAS"], variants, sourceProduct };
}

describe("canonical product transformation", () => {
  it("excludes every owner of a globally duplicated SKU before manifest validation", () => {
    const result = transformProducts([
      product("Alpha", "alpha", [{ ...product("Alpha", "alpha").sourceProduct!.variants[0]!, sku: "SHARED" }]),
      product("Beta", "beta", [{ ...product("Beta", "beta").sourceProduct!.variants[0]!, sku: "SHARED" }]),
      product("Gamma", "gamma"),
    ], taxonomy);
    expect(result.manifest?.products.map((entry) => entry.slug)).toEqual(["gamma"]);
    expect(result.exclusions.filter((entry) => entry.code === "DUPLICATE_SKU_CONFLICT")).toHaveLength(1);
  });

  it("preserves real sparse variants, zero stock, gallery order, memberships, and image associations", () => {
    const source = product("Protein", "protein", [
      { id: "v1", sku: "SKU-1", price: 1250, options: { Sabor: "Cookies & Cream", Tamano: "300g" }, stockMode: "TRACKED", quantity: 0, imageId: "protein-image", logistics: { weightGrams: 300 } },
      { id: "v2", sku: "SKU-2", price: 1250, options: { Sabor: "Vainilla", Tamano: "900g" }, stockMode: "TRACKED", quantity: 4, logistics: { weightGrams: 900 } },
    ]);
    const result = transformProducts([source], taxonomy);
    expect(result.manifest?.products[0]).toMatchObject({
      price: 1250,
      categorySlugs: ["suplementos", "proteinas"],
      images: [{ storageKey: "products/protein/1.webp", position: 1 }],
      variants: [
        { sku: "SKU-1", attributes: { sabor: "cookies-cream", tamano: "300g" }, quantity: 0, primaryImageStorageKey: "products/protein/1.webp" },
        { sku: "SKU-2", attributes: { sabor: "vainilla", tamano: "900g" }, quantity: 4 },
      ],
    });
    expect(JSON.stringify(result.manifest)).not.toContain("missingLogistics");
    expect(JSON.stringify(result.manifest)).not.toContain("skuSet");
  });

  it("excludes unrepresentable prices, over-wide option matrices, and missing structured sources", () => {
    const priceVariance = product("Varied", "varied", [
      { id: "a", sku: "A", price: 100, options: {}, stockMode: "TRACKED", quantity: 1, logistics: { weightGrams: 100 } },
      { id: "b", sku: "B", price: 200, options: {}, stockMode: "TRACKED", quantity: 1, logistics: { weightGrams: 100 } },
    ]);
    const wide = product("Wide", "wide", [{ id: "wide-v", sku: "W", price: 100, options: { One: "A", Two: "B", Three: "C" }, stockMode: "TRACKED", quantity: 1, logistics: { weightGrams: 100 } }]);
    const missingPrice = product("No price", "no-price", [{ id: "np-v", sku: "NP", options: {}, stockMode: "TRACKED", quantity: 1, logistics: { weightGrams: 100 } }]);
    const invalidLogistics = product("Bad logistics", "bad-logistics", [{ id: "bl-v", sku: "BL", price: 100, options: {}, stockMode: "TRACKED", quantity: 1, logistics: { weightGrams: 100, lengthCm: -1 } }]);
    const missing: ExtractedProduct = { ...product("Missing", "missing"), sourceProduct: undefined };
    const result = transformProducts([priceVariance, wide, missingPrice, invalidLogistics, missing], taxonomy);
    expect(result.manifest).toBeUndefined();
    expect(result.exclusions.map((entry) => entry.code).sort()).toEqual(["INVALID_LOGISTICS", "MISSING_PRICE", "MISSING_STRUCTURED_SOURCE", "PRICE_VARIANCE_UNSUPPORTED", "UNSUPPORTED_VARIANT_SHAPE"]);
  });
});
