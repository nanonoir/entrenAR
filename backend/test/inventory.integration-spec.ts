import { randomUUID } from "node:crypto";

import { HttpException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility, StockMode } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { INVENTORY_ORIGIN } from "../src/modules/inventory/inventory.constants";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { inventoryUpdateSchema } from "../src/modules/inventory/inventory.schemas";

const databaseUrl = process.env["DATABASE_URL"];
const ACTOR = { actorId: "inventory-integration-admin", origin: INVENTORY_ORIGIN.ADMIN_MANUAL };

describe("inventory concurrency integration", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }),
  });
  const service = new InventoryService(new InventoryRepository(prisma as unknown as PrismaService));

  beforeAll(() => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for inventory integration tests.");
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows one competing deduction and records exactly one history entry", async () => {
    const fixture = await createFixture(prisma, 1);
    const request = inventoryUpdateSchema.parse({
      operation: "subtract",
      quantity: 1,
      variantId: fixture.variantId,
    });

    const results = await Promise.allSettled([
      service.update(fixture.productId, request, ACTOR),
      service.update(fixture.productId, request, ACTOR),
    ]);
    const finalVariant = await prisma.productVariant.findUniqueOrThrow({
      select: { quantity: true, stockMode: true },
      where: { id: fixture.variantId },
    });
    const historyCount = await prisma.inventoryHistory.count({ where: { variantId: fixture.variantId } });

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected").map((result) => {
      return result.status === "rejected" ? errorCode(result.reason) : undefined;
    })).toEqual(["OUT_OF_STOCK"]);
    expect(finalVariant).toEqual({ quantity: 0, stockMode: StockMode.TRACKED });
    expect(historyCount).toBe(1);
  });

  it("records each successful concurrent deduction with its own resulting stock", async () => {
    const fixture = await createFixture(prisma, 10);
    const request = inventoryUpdateSchema.parse({
      operation: "subtract",
      quantity: 3,
      variantId: fixture.variantId,
    });

    await expect(Promise.all([
      service.update(fixture.productId, request, ACTOR),
      service.update(fixture.productId, request, ACTOR),
    ])).resolves.toHaveLength(2);
    const history = await prisma.inventoryHistory.findMany({
      orderBy: { createdAt: "asc" },
      select: { resultingQuantity: true },
      where: { variantId: fixture.variantId },
    });

    expect(history.map((item) => item.resultingQuantity).sort()).toEqual([4, 7]);
  });

  it("rejects impossible deductions without history and preserves prior history after later operations", async () => {
    const fixture = await createFixture(prisma, 2);
    const subtractThree = inventoryUpdateSchema.parse({
      operation: "subtract",
      quantity: 3,
      reason: "attempted oversell",
      variantId: fixture.variantId,
    });

    await expectOutOfStock(service.update(fixture.productId, subtractThree, ACTOR));
    await expect(prisma.inventoryHistory.count({ where: { variantId: fixture.variantId } })).resolves.toBe(0);

    await service.update(fixture.productId, inventoryUpdateSchema.parse({
      operation: "subtract",
      quantity: 1,
      reason: "manual correction",
      variantId: fixture.variantId,
    }), ACTOR);
    const firstHistory = await prisma.inventoryHistory.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
      where: { variantId: fixture.variantId },
    });

    await service.update(fixture.productId, inventoryUpdateSchema.parse({
      operation: "add",
      quantity: 1,
      variantId: fixture.variantId,
    }), ACTOR);

    await expect(prisma.inventoryHistory.findUnique({ where: { id: firstHistory.id } })).resolves.toEqual(firstHistory);
    await expect(prisma.inventoryHistory.update({
      data: { reason: "mutation must fail" },
      where: { id: firstHistory.id },
    })).rejects.toThrow();
  });

  it("transitions infinite inventory to limited without fabricating quantity", async () => {
    const fixture = await createFixture(prisma, null);

    await expectInvalidOperation(service.update(fixture.productId, inventoryUpdateSchema.parse({
      operation: "add",
      quantity: 1,
      variantId: fixture.variantId,
    }), ACTOR));
    await expect(prisma.inventoryHistory.count({ where: { variantId: fixture.variantId } })).resolves.toBe(0);

    const result = await service.update(fixture.productId, inventoryUpdateSchema.parse({
      operation: "replace",
      quantity: 4,
      stockMode: "limited",
      variantId: fixture.variantId,
    }), ACTOR);
    const variant = await prisma.productVariant.findUniqueOrThrow({
      select: { quantity: true, stockMode: true },
      where: { id: fixture.variantId },
    });

    expect(result).toEqual({
      productId: fixture.productId,
      quantity: 4,
      stock: 4,
      stockMode: "limited",
      variantId: fixture.variantId,
    });
    expect(variant).toEqual({ quantity: 4, stockMode: StockMode.TRACKED });
  });
});

async function createFixture(prisma: PrismaClient, initialQuantity: number | null): Promise<{ productId: string; variantId: string }> {
  const id = randomUUID();
  const productId = `inventory-product-${id}`;
  const variantId = `inventory-variant-${id}`;
  const infinite = initialQuantity === null;

  await prisma.product.create({
    data: {
      id: productId,
      name: "Inventory integration fixture",
      publicSlug: `inventory-public-${id}`,
      quantity: infinite ? null : initialQuantity,
      salePrice: "100.00",
      sku: `INV-PRODUCT-${id}`,
      slug: `inventory-${id}`,
      stockMode: infinite ? StockMode.INFINITE : StockMode.TRACKED,
      visibility: CatalogVisibility.HIDDEN,
      variants: {
        create: {
          id: variantId,
          isDefault: true,
          name: "Fixture variant",
          quantity: infinite ? null : initialQuantity,
          sku: `INV-VARIANT-${id}`,
          stockMode: infinite ? StockMode.INFINITE : StockMode.TRACKED,
        },
      },
    },
  });

  return { productId, variantId };
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();

  return typeof response === "object" && response !== null && "code" in response && typeof response.code === "string"
    ? response.code
    : undefined;
}

async function expectOutOfStock(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(errorCode(error)).toBe("OUT_OF_STOCK");
    return;
  }

  throw new Error("Expected the inventory operation to reject with OUT_OF_STOCK.");
}

async function expectInvalidOperation(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(errorCode(error)).toBe("INVALID_INVENTORY_OPERATION");
    return;
  }

  throw new Error("Expected the inventory operation to reject with INVALID_INVENTORY_OPERATION.");
}
