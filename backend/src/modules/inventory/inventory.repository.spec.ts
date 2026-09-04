import { PrismaService } from "../../common/prisma/prisma.service";
import type { Prisma } from "../../generated/prisma/client";
import { InventoryOperation, StockMode } from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "./inventory.constants";
import { InventoryRepository } from "./inventory.repository";

describe("InventoryRepository stock increments", () => {
  it("increments a tracked product and records an auditable cancellation movement", async () => {
    const harness = createHarness();
    harness.transaction.product.findUnique
      .mockResolvedValueOnce({ id: "product-1", quantity: 2, stockMode: StockMode.TRACKED })
      .mockResolvedValueOnce({ id: "product-1", quantity: 4, stockMode: StockMode.TRACKED });
    harness.transaction.product.updateMany.mockResolvedValue({ count: 1 });

    await harness.repository.restoreStockForItems(harness.transaction, [{ productId: "product-1", quantity: 2 }]);

    expect(harness.transaction.product.updateMany).toHaveBeenCalledWith({
      data: { quantity: { increment: 2 } },
      where: { id: "product-1", stockMode: StockMode.TRACKED },
    });
    expect(harness.transaction.inventoryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 2,
        operation: InventoryOperation.ADD,
        origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION,
        productId: "product-1",
        resultingQuantity: 4,
        stockMode: StockMode.TRACKED,
      }),
    });
  });

  it("increments a tracked variant without touching its parent product", async () => {
    const harness = createHarness();
    harness.transaction.productVariant.findFirst
      .mockResolvedValueOnce({ id: "variant-1", productId: "product-1", quantity: 1, stockMode: StockMode.TRACKED })
      .mockResolvedValueOnce({ id: "variant-1", productId: "product-1", quantity: 3, stockMode: StockMode.TRACKED });
    harness.transaction.productVariant.updateMany.mockResolvedValue({ count: 1 });

    await harness.repository.restoreStockForItems(harness.transaction, [{ productId: "product-1", quantity: 2, variantId: "variant-1" }], {
      actorId: "admin-1",
      origin: INVENTORY_ORIGIN.PURCHASE_ORDER,
      reason: "Supplier receipt",
    });

    expect(harness.transaction.productVariant.updateMany).toHaveBeenCalledWith({
      data: { quantity: { increment: 2 } },
      where: { id: "variant-1", productId: "product-1", stockMode: StockMode.TRACKED },
    });
    expect(harness.transaction.product.updateMany).not.toHaveBeenCalled();
    expect(harness.transaction.inventoryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        origin: INVENTORY_ORIGIN.PURCHASE_ORDER,
        reason: "Supplier receipt",
        resultingQuantity: 3,
        variantId: "variant-1",
      }),
    });
  });

  it("skips infinite-stock targets without creating a movement", async () => {
    const harness = createHarness();
    harness.transaction.product.findUnique.mockResolvedValue({ id: "product-1", quantity: null, stockMode: StockMode.INFINITE });

    await expect(harness.repository.restoreStockForItems(harness.transaction, [{ productId: "product-1", quantity: 2 }])).resolves.toBeUndefined();

    expect(harness.transaction.product.updateMany).not.toHaveBeenCalled();
    expect(harness.transaction.inventoryHistory.create).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const transaction = {
    inventoryHistory: { create: jest.fn() },
    product: { findUnique: jest.fn(), updateMany: jest.fn() },
    productVariant: { findFirst: jest.fn(), updateMany: jest.fn() },
  } as unknown as Prisma.TransactionClient & {
    inventoryHistory: { create: jest.Mock };
    product: { findUnique: jest.Mock; updateMany: jest.Mock };
    productVariant: { findFirst: jest.Mock; updateMany: jest.Mock };
  };

  return { repository: new InventoryRepository({} as PrismaService), transaction };
}
