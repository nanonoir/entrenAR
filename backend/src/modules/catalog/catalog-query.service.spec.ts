import { NotFoundException } from "@nestjs/common";
import { CatalogVisibility } from "../../generated/prisma/enums";
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
