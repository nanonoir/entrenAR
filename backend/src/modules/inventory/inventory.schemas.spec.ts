import { inventoryUpdateSchema } from "./inventory.schemas";

describe("inventoryUpdateSchema", () => {
  it.each([
    [{ operation: "add", quantity: 0 }],
    [{ operation: "subtract", quantity: -1 }],
    [{ operation: "replace", stockMode: "limited", quantity: 1.5 }],
    [{ operation: "replace", stockMode: "infinite", quantity: 1 }],
    [{ operation: "replace", quantity: 2 }],
    [{ operation: "add", quantity: 2, resultingStock: 999 }],
  ])("rejects ambiguous, zero, negative, fractional, or client-resulting requests: %o", (input) => {
    expect(inventoryUpdateSchema.safeParse(input).success).toBe(false);
  });

  it("accepts only an operation input for a limited replacement", () => {
    expect(inventoryUpdateSchema.parse({
      operation: "replace",
      quantity: 7,
      stockMode: "limited",
      variantId: "variant-1",
    })).toEqual({
      operation: "replace",
      quantity: 7,
      stockMode: "limited",
      variantId: "variant-1",
    });
  });
});
