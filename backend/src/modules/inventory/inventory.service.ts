import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { InventoryOperation, StockMode } from "../../generated/prisma/enums";
import {
  INVENTORY_OPERATION,
  INVENTORY_STOCK_MODE,
  type InventoryOperationInput,
} from "./inventory.constants";
import {
  formatInventoryStock,
  normalizeInventoryState,
  toAdminInventoryRecord,
  type AdminInventoryRecord,
  type InventoryState,
} from "./inventory.mapper";
import {
  InventoryRepository,
  type InventoryHistoryPageRow,
  type InventoryTarget,
} from "./inventory.repository";
import type { InventoryHistoryQuery, InventoryUpdateInput } from "./inventory.schemas";

export interface InventoryActor {
  actorId: string;
  origin: string;
}

export interface InventoryHistoryItem {
  actor: string;
  change: string;
  createdAt: string;
  id: string;
  origin: string;
  productId: string;
  productName: string;
  reason?: string;
  resultingStock: string;
  type: "stock-edit";
  variantId?: string;
  variantName?: string;
}

export interface InventoryHistoryPage {
  items: readonly InventoryHistoryItem[];
  limit: number;
  page: number;
  total: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async update(
    productId: string,
    input: InventoryUpdateInput,
    actor: InventoryActor,
  ): Promise<AdminInventoryRecord> {
    return this.inventoryRepository.transaction(async (transaction) => {
      const target = await this.inventoryRepository.findTarget(transaction, productId, input.variantId);

      if (!target) {
        throw new NotFoundException({
          code: ERROR_CODE.NOT_FOUND,
          message: "The requested inventory target was not found.",
          ok: false,
        });
      }

      const current = normalizeInventoryState(target);
      if (target.stockMode === StockMode.OUT_OF_STOCK) {
        await this.inventoryRepository.replaceState(transaction, target, current);
      }
      const next = await this.nextState(transaction, target, current, input);
      await this.inventoryRepository.createHistory(transaction, {
        actorId: actor.actorId,
        delta: this.historyDelta(input),
        operation: this.persistenceOperation(input.operation),
        origin: actor.origin,
        productId: target.productId,
        quantity: next.quantity,
        reason: input.reason,
        stockMode: next.stockMode,
        variantId: target.variantId,
      });

      return toAdminInventoryRecord(target.productId, target.variantId, next);
    });
  }

  async history(query: InventoryHistoryQuery): Promise<InventoryHistoryPage> {
    const result = await this.inventoryRepository.historyPage(
      query.productId,
      query.variantId,
      (query.page - 1) * query.limit,
      query.limit,
    );

    return {
      items: result.items.map((item) => this.toHistoryItem(item)),
      limit: query.limit,
      page: query.page,
      total: result.total,
    };
  }

  private async nextState(
    transaction: Parameters<InventoryRepository["findTarget"]>[0],
    target: InventoryTarget,
    current: InventoryState,
    input: InventoryUpdateInput,
  ): Promise<InventoryState> {
    if (input.operation === INVENTORY_OPERATION.REPLACE) {
      const next = input.stockMode === INVENTORY_STOCK_MODE.INFINITE
        ? { quantity: null, stockMode: StockMode.INFINITE }
        : { quantity: input.quantity ?? 0, stockMode: StockMode.TRACKED };

      await this.inventoryRepository.replaceState(transaction, target, next);
      return next;
    }

    if (current.stockMode === StockMode.INFINITE) {
      throw this.invalidOperation("Infinite inventory can only be replaced.");
    }

    const quantity = input.quantity ?? 0;
    const isSubtract = input.operation === INVENTORY_OPERATION.SUBTRACT;
    const delta = isSubtract ? -quantity : quantity;
    const applied = await this.inventoryRepository.applyLimitedDelta(
      transaction,
      target,
      delta,
      isSubtract ? quantity : 0,
    );

    if (!applied) {
      if (isSubtract) {
        throw this.outOfStock();
      }

      throw this.invalidOperation("Inventory state changed before the operation could be applied.");
    }

    const updated = await this.inventoryRepository.findTarget(transaction, target.productId, target.variantId);

    if (!updated) {
      throw this.invalidOperation("Inventory target disappeared during the operation.");
    }

    return normalizeInventoryState(updated);
  }

  private persistenceOperation(operation: InventoryOperationInput): InventoryOperation {
    if (operation === INVENTORY_OPERATION.ADD) return InventoryOperation.ADD;
    if (operation === INVENTORY_OPERATION.SUBTRACT) return InventoryOperation.SUBTRACT;
    return InventoryOperation.REPLACE;
  }

  private historyDelta(input: InventoryUpdateInput): number | undefined {
    if (input.operation === INVENTORY_OPERATION.ADD) return input.quantity;
    if (input.operation === INVENTORY_OPERATION.SUBTRACT) return -(input.quantity ?? 0);
    return undefined;
  }

  private toHistoryItem(item: InventoryHistoryPageRow): InventoryHistoryItem {
    return {
      actor: item.actorId ?? "System",
      change: this.historyChange(item.operation, item.delta, { quantity: item.quantity, stockMode: item.stockMode }),
      createdAt: item.createdAt.toISOString(),
      id: item.id,
      origin: item.origin,
      productId: item.productId,
      productName: item.productName,
      ...(item.reason ? { reason: item.reason } : {}),
      resultingStock: formatInventoryStock({ quantity: item.quantity, stockMode: item.stockMode }),
      type: "stock-edit",
      ...(item.variantId ? { variantId: item.variantId } : {}),
      ...(item.variantName ? { variantName: item.variantName } : {}),
    };
  }

  private historyChange(operation: InventoryOperation, delta: number | undefined, state: InventoryState): string {
    if (operation === InventoryOperation.ADD) return `Added ${delta ?? 0}; resulting stock ${formatInventoryStock(state)}.`;
    if (operation === InventoryOperation.SUBTRACT) return `Subtracted ${Math.abs(delta ?? 0)}; resulting stock ${formatInventoryStock(state)}.`;
    return `Replaced stock with ${formatInventoryStock(state)}.`;
  }

  private invalidOperation(message: string): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.INVALID_INVENTORY_OPERATION,
      message,
      ok: false,
    });
  }

  private outOfStock(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.OUT_OF_STOCK,
      message: "Insufficient limited inventory for this operation.",
      ok: false,
    });
  }
}
