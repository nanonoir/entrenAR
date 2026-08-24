import { productCreateSchema } from "./catalog.schemas";

const baseProduct = {
  categoryIds: ["category-1"],
  description: "A catalog product description.",
  name: "Catalog product",
  salePrice: 99.99,
  stockMode: "limited",
  stockQuantity: 10,
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
});
