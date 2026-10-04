import { productCreateSchema, publicProductListQuerySchema } from "./catalog.schemas";

const baseProduct = {
  categoryIds: ["category-1"],
  description: "A catalog product description.",
  name: "Catalog product",
  price: 99.99,
  visibility: "visible",
};

describe("catalog product schemas", () => {
  it.each([
    {
      ...baseProduct,
      variantProperties: [
        { name: "Size", values: ["S"] },
        { name: "size", values: ["M"] },
      ],
    },
    { ...baseProduct, stockMode: "infinite", stockQuantity: 1 },
    { ...baseProduct, promotionalPrice: 99.99 },
    { ...baseProduct, categoryIds: ["category-1", "category-1"] },
  ])("rejects invalid catalog input: %o", (input) => {
    expect(productCreateSchema.safeParse(input).success).toBe(false);
  });

  it("normalizes string option values for Cartesian validation", () => {
    const result = productCreateSchema.parse({
      ...baseProduct,
      variantProperties: [{ name: "Color", values: ["Black"] }],
    });

    expect(result.variantProperties).toEqual([
      { id: "color", name: "Color", values: [{ id: "black", label: "Black" }] },
    ]);
  });

  it("validates and deduplicates public listing filters", () => {
    expect(publicProductListQuerySchema.parse({ brandSlugs: "ena,star-nutrition,ena", limit: "100" })).toMatchObject({
      brandSlugs: ["ena", "star-nutrition"],
      limit: 100,
    });
    expect(publicProductListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(publicProductListQuerySchema.safeParse({ minPrice: 20, maxPrice: 10 }).success).toBe(false);
    expect(publicProductListQuerySchema.safeParse({ brandSlugs: Array.from({ length: 21 }, (_, index) => `brand-${index}`).join(",") }).success).toBe(false);
  });
});
