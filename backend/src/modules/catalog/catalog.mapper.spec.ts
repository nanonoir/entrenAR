import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import {
  toAdminCatalogProduct,
  toPublicCatalogProduct,
  toPublicCategories,
  type CatalogProduct,
} from "./catalog.mapper";

describe("catalog mappers", () => {
  it("maps Decimal-compatible prices to finite numbers and keeps slug namespaces separate", () => {
    const product = fixtureProduct();
    const admin = toAdminCatalogProduct(product);
    const publicProduct = toPublicCatalogProduct(product);

    expect(admin.slug).toBe("crm-product");
    expect(admin.publicSlug).toBe("storefront-product");
    expect(admin.salePrice).toBe(19.99);
    expect(admin.variantCombinations[0]?.price).toBe(19.99);
    expect(publicProduct.slug).toBe("storefront-product");
    expect(publicProduct.price).toBe(19.99);
    expect(publicProduct.variants[0]?.price).toBe(19.99);
    expect(Number.isFinite(publicProduct.price)).toBe(true);
  });

  it("returns a stable flat public category projection without hidden descendants", () => {
    const categories = [
      category({ id: "parent", sortOrder: 1, visibility: CatalogVisibility.HIDDEN }),
      category({ id: "child", parentId: "parent", sortOrder: 1 }),
      category({ id: "visible-b", sortOrder: 2 }),
      category({ id: "visible-a", sortOrder: 2 }),
    ];

    expect(toPublicCategories(categories)).toEqual([
      { id: "visible-a", name: "visible-a", slug: "visible-a" },
      { id: "visible-b", name: "visible-b", slug: "visible-b" },
    ]);
  });
});

function fixtureProduct(): CatalogProduct {
  const now = new Date("2026-08-24T00:00:00.000Z");
  return {
    brand: null,
    categories: [{ categoryId: "cat-1", productId: "product-1", createdAt: now, category: category({ id: "cat-1" }) }],
    compareAtPrice: null,
    createdAt: now,
    description: "Catalog product description.",
    heightCm: null,
    highlightSections: [],
    id: "product-1",
    imageTone: null,
    imageUrl: null,
    isBestSeller: false,
    isFeatured: false,
    legacySourceId: null,
    lengthCm: null,
    manualOrder: 1,
    missingLogistics: false,
    name: "Catalog product",
    promotionalPrice: null,
    publicSlug: "storefront-product",
    quantity: 3,
    salePrice: decimal("19.99"),
    seoDescription: null,
    seoTitle: null,
    shippingRequired: true,
    sku: "PRODUCT-1",
    slug: "crm-product",
    stockMode: StockMode.TRACKED,
    subcategorySlugs: [],
    tags: [],
    updatedAt: now,
    variantProperties: [],
    variants: [{
      attributes: {},
      compareAtPrice: null,
      createdAt: now,
      id: "variant-1",
      isDefault: true,
      name: "Default",
      price: null,
      productId: "product-1",
      quantity: 3,
      sku: "VARIANT-1",
      stockMode: StockMode.TRACKED,
      updatedAt: now,
    }],
    visibility: CatalogVisibility.VISIBLE,
    weightGrams: null,
    widthCm: null,
  } as unknown as CatalogProduct;
}

function category(overrides: Partial<{ id: string; parentId: string | null; sortOrder: number; visibility: CatalogVisibility }> = {}) {
  const now = new Date("2026-08-24T00:00:00.000Z");
  const id = overrides.id ?? "category";
  return {
    createdAt: now,
    description: null,
    googleShoppingCategory: null,
    id,
    imageUrl: null,
    name: id,
    parentId: overrides.parentId ?? null,
    seoDescription: null,
    seoTitle: null,
    slug: id,
    sortOrder: overrides.sortOrder ?? 1,
    updatedAt: now,
    visibility: overrides.visibility ?? CatalogVisibility.VISIBLE,
  } as unknown as Parameters<typeof toPublicCategories>[0][number];
}

function decimal(value: string): { toString(): string } {
  return { toString: () => value };
}
