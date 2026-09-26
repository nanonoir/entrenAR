import { CatalogManifestValidationError, normalizeCatalogImportManifest, sanitizeHtml } from "./manifest-validator";

const validManifest = {
  products: [{
    slug: "whey-pro",
    name: "Whey Pro",
    price: 8000,
    compareAtPrice: 10000,
    categorySlugs: ["protein"],
    images: [{ position: 1, storageKey: "products/whey-pro/1.webp", alt: "Whey" }],
    variants: [{ sku: "WHEY-001", name: "Simple", attributes: {}, stockMode: "TRACKED", quantity: 2 }],
  }],
};

describe("catalog import manifest validator", () => {
  it("rejects an empty manifest", () => {
    expect(() => normalizeCatalogImportManifest({ products: [] })).toThrow(CatalogManifestValidationError);
  });

  it("normalizes descriptions and preserves sparse real variants", () => {
    const plan = normalizeCatalogImportManifest({
      products: [{
        ...validManifest.products[0],
        descriptionHtml: "<p>Safe</p><script>alert(1)</script><strong>content</strong>",
        variantProperties: [{ id: "color", name: "Color", values: [{ id: "red", label: "Red" }] }],
        variants: [{ sku: "WHEY-001", name: "Red", attributes: { color: "red" }, stockMode: "TRACKED", quantity: 0, primaryImageStorageKey: "products/whey-pro/1.webp" }],
      }],
    });

    expect(plan.products[0]!.descriptionHtml).toBe("<p>Safe</p>alert(1)<strong>content</strong>");
    expect(plan.products[0]!.publicSlug).toBe("whey-pro");
    expect(plan.products[0]!.variants).toHaveLength(1);
  });

  it("rejects duplicate identities, invalid galleries, unsafe combinations, and invalid stock", () => {
    expect(() => normalizeCatalogImportManifest({
      products: [{
        ...validManifest.products[0],
        images: [{ position: 1, storageKey: "products/other/1.webp", alt: "Other" }],
        variants: [
          { sku: "DUPLICATE", name: "One", attributes: {}, stockMode: "TRACKED" },
          { sku: "DUPLICATE", name: "Two", attributes: {}, stockMode: "INFINITE", quantity: 1 },
        ],
      }],
    })).toThrow(CatalogManifestValidationError);
  });

  it("allows only safe tags and protocol URLs", () => {
    expect(sanitizeHtml('<p>x</p><img src="x"><a href="https://example.com">go</a><a href="javascript:bad">bad</a>'))
      .toBe('<p>x</p><a href="https://example.com">go</a><a>bad</a>');
  });

  it("requires declared property values and same-product primary images", () => {
    expect(() => normalizeCatalogImportManifest({
      products: [{
        ...validManifest.products[0],
        variantProperties: [{ id: "color", name: "Color", values: [{ id: "red", label: "Red" }] }],
        variants: [{ sku: "WHEY-001", attributes: { color: "blue" }, stockMode: "TRACKED", quantity: 1, primaryImageStorageKey: "products/other/1.webp" }],
      }],
    })).toThrow(CatalogManifestValidationError);
  });
});
