import { PrismaService } from "../../common/prisma/prisma.service";
import type { Prisma } from "../../generated/prisma/client";
import {
  InventoryMovementKind,
  InventoryOperation,
  InventoryReferenceType,
  StockMode,
} from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "./inventory.constants";
import { InventoryRepository, type InventoryLedgerContext } from "./inventory.repository";

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

describe("InventoryRepository referenced ledger movements", () => {
  it("deducts a tracked product and variant under one ledger effect", async () => {
    const harness = createHarness();
    harness.transaction.product.findUnique
      .mockResolvedValueOnce({ id: "product-1", quantity: 5, stockMode: StockMode.TRACKED })
      .mockResolvedValueOnce({ id: "product-1", quantity: 3, stockMode: StockMode.TRACKED });
    harness.transaction.productVariant.findFirst
      .mockResolvedValueOnce({ id: "variant-1", productId: "product-2", quantity: 4, stockMode: StockMode.TRACKED })
      .mockResolvedValueOnce({ id: "variant-1", productId: "product-2", quantity: 3, stockMode: StockMode.TRACKED });
    harness.transaction.product.updateMany.mockResolvedValue({ count: 1 });
    harness.transaction.productVariant.updateMany.mockResolvedValue({ count: 1 });
    harness.transaction.inventoryHistory.create
      .mockResolvedValueOnce({ id: "deduction-product" })
      .mockResolvedValueOnce({ id: "deduction-variant" });

    const movements = await harness.repository.deductStockForItems(harness.transaction, [
      { productId: "product-1", quantity: 2 },
      { productId: "product-2", quantity: 1, variantId: "variant-1" },
    ], ledgerContext());

    expect(movements).toEqual([
      expect.objectContaining({ id: "deduction-product", productId: "product-1", quantity: 2 }),
      expect.objectContaining({ id: "deduction-variant", productId: "product-2", quantity: 1, variantId: "variant-1" }),
    ]);
    expect(harness.transaction.inventoryHistory.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        inventoryEffectId: "effect-1",
        movementKind: "SALE_DEDUCTION",
        operationId: "operation-1",
        referenceId: "order-1",
        referenceType: "ORDER",
        variantId: "variant-1",
      }),
    });
  });

  it("fails closed when a referenced deduction target becomes incompatible", async () => {
    const harness = createHarness();
    harness.transaction.inventoryHistory.findMany.mockResolvedValue([
      { delta: -2, id: "deduction-1", productId: "product-1", variantId: null },
    ]);
    harness.transaction.product.findUnique.mockResolvedValue({ id: "product-1", quantity: null, stockMode: StockMode.INFINITE });

    await expect(harness.repository.restoreUncompensatedDeductions(harness.transaction, ledgerContext())).rejects.toThrow("incompatible");
    expect(harness.transaction.product.updateMany).not.toHaveBeenCalled();
    expect(harness.transaction.inventoryHistory.create).not.toHaveBeenCalled();
  });

  it("writes one restoration uniquely linked to each outstanding deduction", async () => {
    const harness = createHarness();
    harness.transaction.inventoryHistory.findMany.mockResolvedValue([
      { delta: -2, id: "deduction-1", productId: "product-1", variantId: null },
    ]);
    harness.transaction.product.findUnique
      .mockResolvedValueOnce({ id: "product-1", quantity: 3, stockMode: StockMode.TRACKED })
      .mockResolvedValueOnce({ id: "product-1", quantity: 5, stockMode: StockMode.TRACKED });
    harness.transaction.product.updateMany.mockResolvedValue({ count: 1 });
    harness.transaction.inventoryHistory.create.mockResolvedValue({ id: "restoration-1" });

    await harness.repository.restoreUncompensatedDeductions(harness.transaction, ledgerContext({ movementKind: "SALE_CANCELLATION_RESTORATION" }));

    expect(harness.transaction.inventoryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        compensatesMovementId: "deduction-1",
        delta: 2,
        movementKind: "SALE_CANCELLATION_RESTORATION",
        operation: InventoryOperation.ADD,
      }),
    });
  });
});

function ledgerContext(overrides: Partial<InventoryLedgerContext> = {}): InventoryLedgerContext {
  return {
    inventoryEffectId: "effect-1",
    movementKind: InventoryMovementKind.SALE_DEDUCTION,
    operationId: "operation-1",
    origin: INVENTORY_ORIGIN.CHECKOUT,
    referenceId: "order-1",
    referenceType: InventoryReferenceType.ORDER,
    ...overrides,
  };
}

function createHarness() {
  const transaction = {
    inventoryHistory: { create: jest.fn(), findMany: jest.fn() },
    product: { findUnique: jest.fn(), updateMany: jest.fn() },
    productVariant: { findFirst: jest.fn(), updateMany: jest.fn() },
  } as unknown as Prisma.TransactionClient & {
    inventoryHistory: { create: jest.Mock; findMany: jest.Mock };
    product: { findUnique: jest.Mock; updateMany: jest.Mock };
    productVariant: { findFirst: jest.Mock; updateMany: jest.Mock };
  };

  return { repository: new InventoryRepository({} as PrismaService), transaction };
}
