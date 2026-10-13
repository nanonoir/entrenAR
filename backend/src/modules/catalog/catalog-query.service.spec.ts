import { NotFoundException } from "@nestjs/common";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import { CATALOG_PUBLIC_PRODUCT_SORT } from "./catalog.constants";
import type { CatalogProduct } from "./catalog.mapper";
import { CatalogQueryService } from "./catalog-query.service";
import { publicProductListQuerySchema } from "./catalog.schemas";

function record(index: number): CatalogProduct {
  const category = { id: "creatina", name: "Creatina", parentId: null, slug: "creatina", sortOrder: 0, visibility: CatalogVisibility.VISIBLE };
  return {
    brand: index % 2 === 0 ? "ENA" : "Star Nutrition",
    categories: [{ category, categoryId: category.id, productId: `product-${index}` }],
    compareAtPrice: index === 2 ? 80 : null,
    createdAt: new Date(index * 1_000),
    description: `Description ${index}`,
    heightCm: null,
    highlightSections: [],
    id: `product-${index}`,
    images: [],
    isBestSeller: index === 1,
    isFeatured: index === 0,
    lengthCm: null,
    manualOrder: index,
    missingLogistics: false,
    name: `Product ${index}`,
    price: index === 2 ? 60 : index + 10,
    promotionalPrice: null,
    publicSlug: `public-${index}`,
    salesCount: index,
    seoDescription: null,
    seoTitle: null,
    shippingRequired: true,
    shortDescription: `Description ${index}`,
    slug: `admin-${index}`,
    subcategorySlugs: ["monohidrato"],
    tags: [],
    updatedAt: new Date(index * 1_000),
    variantProperties: [],
    variants: [],
    visibility: CatalogVisibility.VISIBLE,
    weightGrams: null,
    widthCm: null,
  } as unknown as CatalogProduct;
}

function service(products: CatalogProduct[] = Array.from({ length: 21 }, (_, index) => record(index))) {
  const repository = {
    allCategoriesWithClient: async () => [record(0).categories[0]!.category],
    allProductsWithClient: async () => products,
    productByPublicSlugWithClient: async (slug: string) => products.find(({ publicSlug }) => publicSlug === slug) ?? null,
  };
  return new CatalogQueryService(repository as never);
}

describe("public catalog queries", () => {
  it("keeps canonical ID ties within both availability groups across pages", async () => {
    const products = [record(3), record(2), record(1), record(0)];
    for (const product of products) {
      product.price = record(0).price;
      product.variants = [{ stockMode: StockMode.TRACKED, quantity: Number(["product-1", "product-3"].includes(product.id)) } as CatalogProduct["variants"][number]];
    }
    const pages = await Promise.all([1, 2].map((page) => service(products).publicProducts(publicProductListQuerySchema.parse({ sort: "price-asc", page, limit: 2 }))));
    expect(pages.flatMap(({ items }) => items.map(({ id }) => id))).toEqual(["product-1", "product-3", "product-0", "product-2"]);
  });

  it.each(Object.values(CATALOG_PUBLIC_PRODUCT_SORT))("orders availability before page boundaries while preserving %s within groups", async (sort) => {
    const products = Array.from({ length: 8 }, (_, index) => record(index));
    // Existing ranking is independent of stock; use it as the secondary-order oracle.
    const original = await service(products).publicProducts(publicProductListQuerySchema.parse({ sort, limit: 20 }));
    const availableIds = new Set(["product-3", "product-5", "product-6"]);
    for (const product of products) {
      product.variants = [{ stockMode: StockMode.OUT_OF_STOCK, quantity: 100 } as CatalogProduct["variants"][number]];
      if (availableIds.has(product.id)) product.variants.push({ stockMode: product.id === "product-5" ? StockMode.INFINITE : StockMode.TRACKED, quantity: product.id === "product-5" ? null : 1 } as CatalogProduct["variants"][number]);
    }
    const expected = [true, false].flatMap((available) => original.items.filter(({ id }) => availableIds.has(id) === available).map(({ id }) => id));
    const pages = await Promise.all([1, 2, 3, 4].map((page) => service(products).publicProducts(publicProductListQuerySchema.parse({ sort, limit: 2, page }))));
    expect(pages.flatMap(({ items }) => items.map(({ id }) => id))).toEqual(expected);
    expect(pages.every(({ total, totalPages }) => total === 8 && totalPages === 4)).toBe(true);
    expect(pages[0]!.facets).toEqual(original.facets);
    expect(pages.flatMap(({ items }) => items).filter(({ id }) => !availableIds.has(id)).every(({ stock }) => stock === 0)).toBe(true);
  });

  it.each([
    { search: "Product 2" }, { brandSlug: "ena" }, { categorySlug: "creatina" },
    { offersOnly: "true" }, { categorySlugs: "creatina", minPrice: 12, maxPrice: 60 },
  ])("keeps matching filters without adding available unrelated products: %j", async (filter) => {
    const products = [record(0), record(1), record(2), record(3)];
    const query = publicProductListQuerySchema.parse({ ...filter, limit: 20 });
    const before = await service(products).publicProducts(query);
    products[3]!.variants = [{ stockMode: StockMode.INFINITE, quantity: null } as CatalogProduct["variants"][number]];
    const after = await service(products).publicProducts(query);
    expect(after.items.map(({ id }) => id).sort()).toEqual(before.items.map(({ id }) => id).sort());
    expect(after.total).toBe(before.total);
    expect(after.facets).toEqual(before.facets);
    expect(after.priceBounds).toEqual(before.priceBounds);
  });

  it("paginates beyond page one while keeping full unique totals and facets", async () => {
    const result = await service().publicProducts(publicProductListQuerySchema.parse({ page: 2, limit: 20 }));

    expect(result.items.map(({ id }) => id)).toEqual(["product-20"]);
    expect(result.total).toBe(21);
    expect(result.totalPages).toBe(2);
    expect(result.facets?.brands.reduce((count, brand) => count + brand.count, 0)).toBe(21);
  });

  it("distinguishes valid empty results from repository failures", async () => {
    const empty = await service([]).publicProducts(publicProductListQuerySchema.parse({}));
    expect(empty).toMatchObject({ items: [], total: 0, totalPages: 0, priceBounds: { min: 0, max: 0 } });

    const failure = new Error("catalog unavailable");
    const broken = new CatalogQueryService({
      allCategoriesWithClient: async () => { throw failure; },
      allProductsWithClient: async () => [],
    } as never);
    await expect(broken.publicProducts(publicProductListQuerySchema.parse({}))).rejects.toBe(failure);
  });

  it("applies offer filters and stable sort, and resolves detail by public slug only", async () => {
    const queries = service();
    const offers = await queries.publicProducts(publicProductListQuerySchema.parse({ offersOnly: "true", sort: "price-asc" }));
    expect(offers.items.map(({ id }) => id)).toEqual(["product-2"]);
    await expect(queries.publicProduct("public-3")).resolves.toMatchObject({ slug: "public-3" });
    await expect(queries.publicProduct("admin-3")).rejects.toBeInstanceOf(NotFoundException);
  });
});
