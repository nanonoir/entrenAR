import { CatalogVisibility } from "../../generated/prisma/enums";
import type { CatalogProduct, PublicCatalogCategory } from "./catalog.mapper";
import { filterPublicListing, publicBrandDirectory, publicListingMetadata, publicListingScope } from "./public-listing";
import { publicProductListQuerySchema } from "./catalog.schemas";

const categories: PublicCatalogCategory[] = [
  { id: "category-creatine", name: "Creatina", slug: "creatina" },
  { id: "category-hidden", name: "Hidden", slug: "hidden" },
];

function product(id: string, categoryIds: string[], brand = "ENA", price = 50): CatalogProduct {
  return {
    brand,
    categories: categoryIds.map((categoryId) => ({
      category: { id: categoryId, name: categoryId, slug: categoryId === "category-creatine" ? "creatina" : "hidden" },
      categoryId,
      productId: id,
    })),
    compareAtPrice: null,
    description: "Description",
    id,
    isBestSeller: false,
    isFeatured: false,
    name: `Product ${id}`,
    price,
    salesCount: 0,
    shortDescription: "Description",
    subcategorySlugs: ["monohidrato"],
    tags: [],
    visibility: CatalogVisibility.VISIBLE,
  } as unknown as CatalogProduct;
}

describe("public catalog listing scope and metadata", () => {
  it.each([
    ["creatina-y-pre", "creatina", 60], ["creatina-y-pre", "pre-intra-entreno", 26],
    ["vitaminas", "adaptogenos-hierbas", 22], ["vitaminas", "antioxidantes", 18],
    ["control-de-peso", "cafeina", 6], ["control-de-peso", "cla", 4],
  ] as const)("uses canonical %s/%s memberships with empty legacy JSON", (parentSlug, leafSlug, total) => {
    const hierarchy: PublicCatalogCategory[] = [
      { id: "parent", name: "Parent", slug: parentSlug },
      { id: "leaf", name: "Leaf", slug: leafSlug, parentId: "parent" },
      { id: "other", name: "Other", slug: "other", parentId: "parent" },
    ];
    const records = Array.from({ length: total }, (_, index) => ({ ...product(`p-${index}`, ["leaf"]), subcategorySlugs: [] }));
    const misleading = { ...product("misleading", ["other"]), subcategorySlugs: [leafSlug] };
    const scope = publicListingScope([...records, misleading], hierarchy, parentSlug);
    const query = publicProductListQuerySchema.parse({ categorySlug: parentSlug, subcategorySlugs: leafSlug, brandSlugs: "ena", minPrice: 50, maxPrice: 50 });
    expect(filterPublicListing(scope, query, hierarchy).map(({ id }) => id)).toEqual(records.map(({ id }) => id));
    const metadata = publicListingMetadata([...scope, records[0]!], hierarchy, parentSlug);
    expect(metadata.facets.subcategories).toEqual([{ count: total, label: "Leaf", slug: leafSlug }, { count: 1, label: "Other", slug: "other" }]);
    expect(metadata.facets.brands).toEqual([{ count: total + 1, label: "ENA", slug: "ena" }]);
    expect(publicListingMetadata(records, hierarchy, leafSlug).facets.subcategories).toEqual([]);
  });

  it("keeps legacy-only fixture tags but never substitutes them for a known canonical category", () => {
    const record = product("fixture", ["category-creatine"]);
    const legacy = publicProductListQuerySchema.parse({ subcategorySlugs: "monohidrato" });
    expect(filterPublicListing([record], legacy, categories)).toEqual([record]);
    expect(publicListingMetadata([record], categories).facets.subcategories).toEqual([{ count: 1, label: "monohidrato", slug: "monohidrato" }]);
    const falseTag = { ...record, subcategorySlugs: ["hidden"] };
    expect(filterPublicListing([falseTag], publicProductListQuerySchema.parse({ subcategorySlugs: "hidden" }), categories)).toEqual([]);
  });

  it("keeps canonical unique products and excludes hidden category membership", () => {
    const inScope = publicListingScope([
      product("one", ["category-creatine", "category-hidden"]),
      product("two", ["category-hidden"]),
    ], categories, "creatina");

    expect(inScope.map(({ id }) => id)).toEqual(["one"]);
  });

  it("counts unique products across the full route scope and emits empty safe bounds", () => {
    const shared = product("shared", ["category-creatine"]);
    const metadata = publicListingMetadata([shared, shared, product("second", ["category-creatine"], "Star Nutrition", 90)], categories);

    expect(metadata.facets.brands).toEqual([
      { count: 1, label: "ENA", slug: "ena" },
      { count: 1, label: "Star Nutrition", slug: "star-nutrition" },
    ]);
    expect(metadata.facets.categories).toEqual([{ count: 2, label: "Creatina", slug: "creatina" }]);
    expect(metadata.priceBounds).toEqual({ min: 50, max: 90 });
    expect(publicListingMetadata([], categories).priceBounds).toEqual({ min: 0, max: 0 });
  });

  it("exposes the same eligible unique brand counts as the directory", () => {
    expect(publicBrandDirectory([product("one", ["category-creatine"]), product("two", ["category-creatine"])]))
      .toEqual([{ count: 2, label: "ENA", slug: "ena" }]);
  });

  it("includes publicly visible descendants in a route scope and scopes brand listing metadata", () => {
    const hierarchy: PublicCatalogCategory[] = [
      { id: "root", name: "Suplementos", slug: "suplementos" },
      { id: "leaf", name: "Creatina", parentId: "root", slug: "creatina" },
    ];
    const records = [product("leaf-product", ["leaf"], "ENA"), product("other-brand", ["leaf"], "Other")];
    expect(publicListingScope(records, hierarchy, "suplementos").map(({ id }) => id)).toEqual(["leaf-product", "other-brand"]);
    expect(publicListingScope(records, hierarchy, undefined, "ena").map(({ id }) => id)).toEqual(["leaf-product"]);
  });
});
