import { normalizeCatalogImportManifest } from "../catalog-import/manifest-validator";
import { toPublicCatalogProduct } from "./catalog.mapper";
import { deriveVariantLabel, resolveVariantLabel } from "./variant-label";
import { planVariantNameNormalization } from "./variant-name-normalization";

const properties = [
  { id: "color", name: "Color", values: [{ id: "negro", label: "Negro" }, { id: "azul", label: "Azul" }] },
  { id: "talle", name: "Talle", values: [{ id: "m", label: "M" }, { id: "xl", label: "XL" }] },
];

describe("variant label derivation", () => {
  it("builds the label from declared property order and value labels", () => {
    expect(deriveVariantLabel(properties, { talle: "m", color: "negro" })).toBe("Negro / M");
  });

  it("does not guess when an attribute or value is missing or unknown", () => {
    expect(deriveVariantLabel(properties, { color: "negro" })).toBeUndefined();
    expect(deriveVariantLabel(properties, { color: "negro", talle: "xxl" })).toBeUndefined();
    expect(deriveVariantLabel([], {})).toBeUndefined();
    expect(deriveVariantLabel("not-properties", {})).toBeUndefined();
  });

  it("accepts the shapes allowed by the catalog schema: optional property id and string values", () => {
    const schemaShapes = [{ name: "Color", values: ["Negro", "Azul Marino"] }, { id: "talle", name: "Talle", values: ["M", { id: "xl", label: "XL" }] }];

    expect(deriveVariantLabel(schemaShapes, { color: "azul-marino", talle: "m" })).toBe("Azul Marino / M");
    expect(deriveVariantLabel(schemaShapes, { color: "negro", talle: "xl" })).toBe("Negro / XL");
    expect(deriveVariantLabel([{ values: ["M"] }], { x: "m" })).toBeUndefined();
  });

  it("replaces only SKU or empty names and keeps custom names", () => {
    const attributes = { color: "azul", talle: "xl" };
    expect(resolveVariantLabel({ attributes, name: "SKU-1", sku: "SKU-1" }, properties)).toBe("Azul / XL");
    expect(resolveVariantLabel({ attributes, name: "", sku: "SKU-1" }, properties)).toBe("Azul / XL");
    expect(resolveVariantLabel({ attributes, name: "Edición limitada", sku: "SKU-1" }, properties)).toBe("Edición limitada");
    expect(resolveVariantLabel({ attributes: { color: "azul" }, name: "SKU-1", sku: "SKU-1" }, properties)).toBe("SKU-1");
  });

  it("exposes readable public labels without changing ids, stock or price", () => {
    const product = {
      brand: "EntrenAR", categories: [], compareAtPrice: null, createdAt: new Date(), description: "d", id: "p1", images: [],
      isBestSeller: false, isFeatured: false, name: "Remera", price: { toString: () => "100" }, publicSlug: "remera", shortDescription: null,
      subcategorySlugs: [], tags: [], variantProperties: properties,
      variants: [{ attributes: { color: "negro", talle: "m" }, id: "v1", name: "REM-NEG-M", primaryImageId: null, quantity: 3, sku: "REM-NEG-M", stockMode: "TRACKED" }],
    } as unknown as Parameters<typeof toPublicCatalogProduct>[0];
    const [variant] = toPublicCatalogProduct(product).variants;

    expect(variant).toMatchObject({ id: "v1", label: "Negro / M", optionValues: { color: "negro", talle: "m" }, stock: 3 });
  });
});

describe("variant name normalization plan", () => {
  const base = { attributes: { color: "negro", talle: "m" }, productName: "Remera", variantProperties: properties };

  it("renames structured and simple placeholders and skips custom or unresolvable names", () => {
    const plan = planVariantNameNormalization([
      { ...base, id: "a", name: "S-1", sku: "S-1" },
      { ...base, id: "b", name: "Custom", sku: "S-2" },
      { ...base, attributes: {}, id: "c", name: "S-3", sku: "S-3" },
      { attributes: {}, id: "d", name: "S-4", productName: "Shaker", sku: "S-4", variantProperties: [] },
    ]);

    expect(plan.changes).toEqual([
      { from: "S-1", id: "a", sku: "S-1", to: "Negro / M" },
      { from: "S-4", id: "d", sku: "S-4", to: "Shaker" },
    ]);
    expect(plan.customNames).toBe(1);
    expect(plan.unresolved).toEqual(["c"]);
  });

  it("is idempotent once names are readable", () => {
    const plan = planVariantNameNormalization([{ ...base, id: "a", name: "Negro / M", sku: "S-1" }]);
    expect(plan.changes).toEqual([]);
  });
});

describe("import persists readable variant names", () => {
  it("derives names when the manifest omits them", () => {
    const plan = normalizeCatalogImportManifest({
      products: [
        {
          slug: "remera", name: "Remera", price: 10, weightGrams: 100, categorySlugs: ["c"], variantProperties: properties,
          images: [{ position: 1, storageKey: "products/remera/1.webp" }],
          variants: [{ sku: "R-1", attributes: { color: "negro", talle: "m" }, stockMode: "TRACKED", quantity: 1 }, { sku: "R-2", name: "Custom", attributes: { color: "azul", talle: "xl" }, stockMode: "TRACKED", quantity: 1 }],
        },
        {
          slug: "shaker", name: "Shaker 600ml", price: 10, weightGrams: 100, categorySlugs: ["c"], variantProperties: [],
          images: [{ position: 1, storageKey: "products/shaker/1.webp" }],
          variants: [{ sku: "SH-1", attributes: {}, stockMode: "INFINITE" }],
        },
      ],
    });

    expect(plan.products[0]!.variants.map((variant) => variant.name)).toEqual(["Negro / M", "Custom"]);
    expect(plan.products[1]!.variants[0]!.name).toBe("Shaker 600ml");
    expect(plan.products[0]!.variants.map((variant) => variant.sku)).toEqual(["R-1", "R-2"]);
  });

  it("treats a name equal to the SKU as a placeholder and keeps custom names", () => {
    const plan = normalizeCatalogImportManifest({
      products: [{
        slug: "remera", name: "Remera", price: 10, weightGrams: 100, categorySlugs: ["c"], variantProperties: properties,
        images: [{ position: 1, storageKey: "products/remera/1.webp" }],
        variants: [
          { sku: "R-1", name: "R-1", attributes: { color: "negro", talle: "m" }, stockMode: "TRACKED", quantity: 1 },
          { sku: "R-2", name: "Edición", attributes: { color: "azul", talle: "xl" }, stockMode: "TRACKED", quantity: 1 },
        ],
      }],
    });

    expect(plan.products[0]!.variants.map((variant) => variant.name)).toEqual(["Negro / M", "Edición"]);
  });
});
