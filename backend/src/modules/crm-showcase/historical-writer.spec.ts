import type { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { StockMode } from "../../generated/prisma/enums";
import { CatalogRepository } from "../catalog/catalog.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import { HistoricalWriter } from "./historical-writer";
import { assembleScenario, SHOWCASE_COUNTS } from "./scenario";

interface QuoteTarget { id: string; quantity: number | null; }
interface WriterTestSeam {
  parents: (...args: unknown[]) => Promise<void>;
  calculate: (tx: Prisma.TransactionClient, scenario: unknown, variant: QuoteTarget, index: number) => Promise<unknown>;
  session: (...args: unknown[]) => Promise<unknown>;
  verifyBalances: (...args: unknown[]) => Promise<void>;
}

describe("HistoricalWriter receipt-funded quote validation", () => {
  afterEach(() => jest.restoreAllMocks());

  it("supports zero imported stock by receiving purchases before either quote branch and reaching balance invariants", async () => {
    const at = new Date("2026-10-09T15:00:00Z");
    const variants = Array.from({ length: 12 }, (_, index) => ({
      id: `variant-${index}`, productId: `product-${index}`, sku: `sku-${index}`,
      stockMode: StockMode.TRACKED, quantity: 0, updatedAt: at,
      product: { id: `product-${index}`, name: `Product ${index}`, price: new Prisma.Decimal(100), promotionalPrice: null, compareAtPrice: null, weightGrams: 100, categories: [{ categoryId: "category" }] },
    }));
    const stock = new Map(variants.map((variant) => [variant.id, variant.quantity]));
    const sequence: string[] = [];
    const transaction = {
      productVariant: { findMany: jest.fn().mockResolvedValue(variants) },
      purchaseOrder: { create: jest.fn(async () => { sequence.push("purchase"); }) },
    } as unknown as Prisma.TransactionClient;
    jest.spyOn(CatalogRepository.prototype, "publicCheckoutCategoryIds").mockResolvedValue(new Set(["category"]));
    const receipt = jest.spyOn(InventoryRepository.prototype, "incrementStockForItems").mockImplementation(async (tx, items) => {
      expect(tx).toBe(transaction);
      sequence.push("receipt");
      for (const item of items) stock.set(item.variantId!, stock.get(item.variantId!)! + item.quantity);
    });
    const writer = new HistoricalWriter({} as PrismaService);
    const seam = writer as unknown as WriterTestSeam;
    jest.spyOn(seam, "parents").mockImplementation(async () => { sequence.push("parents"); });
    const quote = jest.spyOn(seam, "calculate").mockImplementation(async (tx, _scenario, variant, index) => {
      expect(tx).toBe(transaction);
      expect(variant.quantity).toBe(0); // Imported selection remains zero; it is not filtered or rewritten.
      sequence.push(`quote:${index}`);
      if (stock.get(variant.id)! < 1) throw new Error("OutOfStock: quote ran before receipt");
      return { calculation: {}, cart: {}, input: {} };
    });
    jest.spyOn(seam, "session").mockResolvedValue(undefined);
    const invariant = new Error("downstream balance invariant reached");
    const balances = jest.spyOn(seam, "verifyBalances").mockImplementation(async (_tx, _scenario, _selected, initial) => {
      expect(initial).toEqual(Object.fromEntries(variants.map((variant) => [variant.id, 0])));
      sequence.push("balances");
      throw invariant; // Stop before unrelated flags/graph persistence, not before the regression path.
    });
    const scenario = assembleScenario({ seed: "zero-stock", referenceDate: at });
    scenario.orders = []; // Isolate preflight/receipts and abandonment orchestration from order snapshots.

    await expect(writer.write(transaction, scenario, {})).rejects.toBe(invariant);
    expect(receipt).toHaveBeenCalledTimes(2);
    expect(transaction.purchaseOrder.create).toHaveBeenCalledTimes(SHOWCASE_COUNTS.purchases);
    expect([...stock.values()]).toEqual(Array(12).fill(20));
    expect(sequence.slice(0, 7)).toEqual(["parents", "purchase", "receipt", "purchase", "receipt", "purchase", "purchase"]);
    expect(sequence[7]).toBe("quote:1000");
    expect(sequence[8]).toBe("quote:1001");
    expect(quote).toHaveBeenCalledTimes(2 + SHOWCASE_COUNTS.abandonments);
    expect(balances).toHaveBeenCalledTimes(1);
    expect(sequence.at(-1)).toBe("balances");
  });
});
