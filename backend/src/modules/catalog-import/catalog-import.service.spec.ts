import { CatalogImportService } from "./catalog-import.service";

describe("CatalogImportService", () => {
  const manifest = {
    products: [{
      slug: "whey-pro", name: "Whey Pro", price: 8000,
      categorySlugs: ["protein"], variantProperties: [], tags: [], shippingRequired: true,
      images: [{ position: 1, storageKey: "products/whey-pro/1.webp" }],
      variants: [{ sku: "WHEY-001", name: "Simple", attributes: {}, stockMode: "TRACKED", quantity: 2 }],
    }],
  };

  it("preflights categories, identities, and media before persistence", async () => {
    const persist = jest.fn().mockResolvedValue({ products: 1, variants: 1, images: 1 });
    const service = new CatalogImportService({
      existingProductSlugs: async () => new Set(), existingPublicSlugs: async () => new Set(), existingVariantSkus: async () => new Set(),
      existingCategorySlugs: async () => new Set(["protein"]), persist,
    }, { exists: async () => true });

    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: true, counts: { products: 1 } });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports missing media without writing", async () => {
    const persist = jest.fn();
    const service = new CatalogImportService({
      existingProductSlugs: async () => new Set(), existingPublicSlugs: async () => new Set(), existingVariantSkus: async () => new Set(),
      existingCategorySlugs: async () => new Set(["protein"]), persist,
    }, { exists: async () => false });

    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: false, issues: [{ code: "MISSING_OBJECT" }] });
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports unknown categories before checking persistence", async () => {
    const persist = jest.fn();
    const service = new CatalogImportService({
      existingProductSlugs: async () => new Set(), existingPublicSlugs: async () => new Set(), existingVariantSkus: async () => new Set(),
      existingCategorySlugs: async () => new Set(), persist,
    }, { exists: async () => true });

    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: false, issues: [{ code: "UNKNOWN_CATEGORY" }] });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects a second import when catalog identities already exist", async () => {
    const persist = jest.fn();
    const service = new CatalogImportService({
      existingProductSlugs: async () => new Set(["whey-pro"]), existingPublicSlugs: async () => new Set(["whey-pro"]), existingVariantSkus: async () => new Set(["WHEY-001"]),
      existingCategorySlugs: async () => new Set(["protein"]), persist,
    }, { exists: async () => true });

    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: false, issues: expect.arrayContaining([
      expect.objectContaining({ code: "PRODUCT_SLUG_CONFLICT" }),
      expect.objectContaining({ code: "PUBLIC_SLUG_CONFLICT" }),
      expect.objectContaining({ code: "VARIANT_SKU_CONFLICT" }),
    ]) });
    expect(persist).not.toHaveBeenCalled();
  });

  it("redacts persistence failures", async () => {
    const service = new CatalogImportService({
      existingProductSlugs: async () => new Set(), existingPublicSlugs: async () => new Set(), existingVariantSkus: async () => new Set(),
      existingCategorySlugs: async () => new Set(["protein"]), persist: async () => { throw new Error("secret database details"); },
    }, { exists: async () => true });

    await expect(service.importCatalog(manifest)).resolves.toEqual({ ok: false, issues: [{ code: "PERSISTENCE_FAILURE", message: "Catalog import could not be completed." }] });
  });
});
