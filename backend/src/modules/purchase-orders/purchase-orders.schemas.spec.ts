import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import {
  createPurchaseOrderSchema,
  purchaseOrderCommandSchema,
  purchaseOrderFilterQuerySchema,
  purchaseOrderItemSchema,
  updatePurchaseOrderSchema,
} from "./purchase-orders.schemas";

describe("purchase-order schemas", () => {
  it("derives item totals and applies creation defaults", () => {
    const parsed = createPurchaseOrderSchema.parse({
      expectedDate: "2026-09-10",
      items: [{
        productId: "product-1",
        quantity: 3,
        sku: "SKU-1",
        title: "Product one",
        unitCost: 12.5,
      }],
      supplierId: "supplier-1",
    });

    expect(parsed).toMatchObject({
      shippingCost: 0,
      supplierId: "supplier-1",
      tax: 0,
    });
    expect(parsed.expectedDate).toEqual(new Date("2026-09-10T00:00:00.000Z"));
    expect(parsed.items).toEqual([expect.objectContaining({ totalCost: 37.5 })]);
    expect(purchaseOrderItemSchema.parse({
      productId: "product-1",
      quantity: 2,
      sku: "SKU-1",
      title: "Product one",
      totalCost: 99,
      unitCost: 12.5,
    }).totalCost).toBe(99);
  });

  it("coerces filters and accepts an empty command payload only", () => {
    expect(purchaseOrderFilterQuerySchema.parse({ status: "ordered", limit: "10" })).toEqual({
      limit: 10,
      page: 1,
      sortBy: "createdAt",
      sortOrder: "desc",
      status: PurchaseOrderStatus.ORDERED,
    });
    expect(purchaseOrderCommandSchema.parse(undefined)).toEqual({});
    expect(purchaseOrderCommandSchema.parse({})).toEqual({});
    expect(purchaseOrderCommandSchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it.each([
    { productId: "product-1", quantity: 0, sku: "SKU", title: "Product", unitCost: 10 },
    { productId: "product-1", quantity: 1.5, sku: "SKU", title: "Product", unitCost: 10 },
    { productId: "product-1", quantity: 1, sku: "", title: "Product", unitCost: 10 },
    { productId: "product-1", quantity: 1, sku: "SKU", title: "Product", unitCost: -1 },
  ])("rejects invalid purchase-order items: %o", (item) => {
    expect(purchaseOrderItemSchema.safeParse(item).success).toBe(false);
  });

  it("rejects invalid creation, update, and filter payloads", () => {
    expect(createPurchaseOrderSchema.safeParse({ supplierId: "supplier-1", items: [] }).success).toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ supplierId: "supplier-1", items: [{
      productId: "product-1",
      quantity: 1,
      sku: "SKU",
      title: "Product",
      unitCost: 10,
      unknown: true,
    }] }).success).toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({}).success).toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({ id: "po-1" }).success).toBe(false);
    expect(purchaseOrderFilterQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(purchaseOrderFilterQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
  });
});
