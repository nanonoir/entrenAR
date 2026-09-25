import { InventoryMovementKind, InventoryOperation, InventoryReferenceType, StockMode } from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { InventoryRepository, type InventoryTarget } from "../inventory/inventory.repository";
import type { Prisma } from "../../generated/prisma/client";
import { CATALOG_PRODUCTS } from "./fixtures/catalog-commerce-baseline";
import type { ShowcaseResetReport } from "./showcase-reset.report";

interface CanonicalInventoryState {
  quantity: number | null;
  stockMode: StockMode;
}

interface CanonicalInventoryTarget extends CanonicalInventoryState {
  productId: string;
  variantId?: string;
}

export class ShowcaseInventoryReconciler {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async reconcile(
    transaction: Prisma.TransactionClient,
    report: ShowcaseResetReport,
    runId: string,
  ): Promise<void> {
    let updated = 0;
    const targets = canonicalInventoryTargets();

    for (const baseline of targets) {
      const current = await this.inventoryRepository.findTarget(transaction, baseline.productId, baseline.variantId);
      if (!current) throw new Error(`Showcase inventory target ${baseline.productId}${baseline.variantId ? `/${baseline.variantId}` : ""} was not found.`);
      if (sameInventoryState(current, baseline)) continue;

      await this.inventoryRepository.replaceState(transaction, current, baseline);
      await this.inventoryRepository.createHistory(transaction, {
        delta: stockDelta(current, baseline),
        movementKind: movementKindFor(current, baseline),
        operation: InventoryOperation.REPLACE,
        origin: INVENTORY_ORIGIN.SHOWCASE_RESET,
        productId: baseline.productId,
        quantity: baseline.quantity,
        referenceId: runId,
        referenceType: InventoryReferenceType.RECONCILIATION,
        stockMode: baseline.stockMode,
        variantId: baseline.variantId,
      });
      updated++;
    }

    report.recordFamily("inventory", { created: 0, preserved: targets.length - updated, updated });
  }
}

function canonicalInventoryTargets(): readonly CanonicalInventoryTarget[] {
  return CATALOG_PRODUCTS.flatMap((product) => [
    toCanonicalTarget(product.id, undefined, product.stock),
    ...product.variants.map((variant) => toCanonicalTarget(product.id, variant.id, variant.stock)),
  ]);
}

function toCanonicalTarget(
  productId: string,
  variantId: string | undefined,
  stock: { kind: string; quantity?: number },
): CanonicalInventoryTarget {
  return stock.kind === "tracked"
    ? { productId, quantity: stock.quantity ?? 0, stockMode: StockMode.TRACKED, ...(variantId ? { variantId } : {}) }
    : { productId, quantity: null, stockMode: StockMode.INFINITE, ...(variantId ? { variantId } : {}) };
}

function sameInventoryState(current: InventoryTarget, baseline: CanonicalInventoryState): boolean {
  return current.quantity === baseline.quantity && current.stockMode === baseline.stockMode;
}

function stockDelta(current: InventoryTarget, baseline: CanonicalInventoryState): number | undefined {
  return current.quantity === null || baseline.quantity === null ? undefined : baseline.quantity - current.quantity;
}

function movementKindFor(current: InventoryTarget, baseline: CanonicalInventoryState): InventoryMovementKind | undefined {
  const delta = stockDelta(current, baseline);
  if (delta === undefined || delta === 0) return undefined;
  return delta > 0
    ? InventoryMovementKind.RECONCILIATION_BASELINE_RESTORATION
    : InventoryMovementKind.RECONCILIATION_BASELINE_DEDUCTION;
}
