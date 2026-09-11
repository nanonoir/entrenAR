import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import {
  InventoryMovementKind,
  InventoryOperation,
  InventoryReferenceType,
  StockMode,
} from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import { INVENTORY_ORIGIN } from "./inventory.constants";
import type { InventoryState } from "./inventory.mapper";

export const INVENTORY_TARGET_KIND = {
  PRODUCT: "product",
  VARIANT: "variant",
} as const;

export type InventoryTargetKind = (typeof INVENTORY_TARGET_KIND)[keyof typeof INVENTORY_TARGET_KIND];

export interface InventoryTarget extends InventoryState {
  kind: InventoryTargetKind;
  productId: string;
  variantId?: string;
}

export interface CreateInventoryHistoryInput extends InventoryState {
  actorId?: string;
  delta?: number;
  operation: InventoryOperation;
  origin: string;
  productId: string;
  reason?: string;
  variantId?: string;
  compensatesMovementId?: string;
  inventoryEffectId?: string;
  movementKind?: InventoryMovementKind;
  operationId?: string;
  referenceId?: string;
  referenceType?: InventoryReferenceType;
}

export interface InventoryStockItem {
  productId: string;
  quantity: number;
  variantId?: string | null;
}

export interface InventoryIncrementOptions {
  actorId?: string;
  origin: string;
  reason?: string;
}

export interface InventoryLedgerContext {
  inventoryEffectId: string;
  movementKind: InventoryMovementKind;
  operationId: string;
  origin: string;
  referenceId: string;
  referenceType: InventoryReferenceType;
  actorId?: string;
  reason?: string;
}

export interface InventoryLedgerMovement {
  id: string;
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface InventoryHistoryPageRow extends CreateInventoryHistoryInput {
  createdAt: Date;
  id: string;
  productName: string;
  variantName?: string;
}

export interface InventoryHistoryPageResult {
  items: readonly InventoryHistoryPageRow[];
  total: number;
}

export const CHECKOUT_STOCK_DEDUCTION_STATUS = {
  DEDUCTED: "deducted",
  NOT_FOUND: "not-found",
  OUT_OF_STOCK: "out-of-stock",
} as const;

export type CheckoutStockDeductionStatus = (typeof CHECKOUT_STOCK_DEDUCTION_STATUS)[keyof typeof CHECKOUT_STOCK_DEDUCTION_STATUS];

export interface CheckoutStockDeductionResult {
  remainingQuantity: number | null;
  status: CheckoutStockDeductionStatus;
  target: InventoryTarget | null;
}

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async findTarget(
    transaction: TransactionClient,
    productId: string,
    variantId: string | undefined,
  ): Promise<InventoryTarget | null> {
    if (variantId) {
      const variant = await transaction.productVariant.findFirst({
        select: { id: true, productId: true, quantity: true, stockMode: true },
        where: { id: variantId, productId },
      });

      return variant
        ? {
          kind: INVENTORY_TARGET_KIND.VARIANT,
          productId: variant.productId,
          quantity: variant.quantity,
          stockMode: variant.stockMode,
          variantId: variant.id,
        }
        : null;
    }

    const product = await transaction.product.findUnique({
      select: { id: true, quantity: true, stockMode: true },
      where: { id: productId },
    });

    return product
      ? {
        kind: INVENTORY_TARGET_KIND.PRODUCT,
        productId: product.id,
        quantity: product.quantity,
        stockMode: product.stockMode,
      }
      : null;
  }

  async applyLimitedDelta(
    transaction: TransactionClient,
    target: InventoryTarget,
    delta: number,
    requiredQuantity: number,
  ): Promise<boolean> {
    const where = {
      id: target.kind === INVENTORY_TARGET_KIND.PRODUCT ? target.productId : target.variantId,
      quantity: { gte: requiredQuantity },
      stockMode: StockMode.TRACKED,
    };
    const data = { quantity: { increment: delta } };

    const result = target.kind === INVENTORY_TARGET_KIND.PRODUCT
      ? await transaction.product.updateMany({ data, where })
      : await transaction.productVariant.updateMany({ data, where });

    return result.count === 1;
  }

  async deductForCheckout(
    transaction: TransactionClient,
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ): Promise<CheckoutStockDeductionResult> {
    const target = await this.findTarget(transaction, productId, variantId);

    if (!target) {
      return {
        remainingQuantity: null,
        status: CHECKOUT_STOCK_DEDUCTION_STATUS.NOT_FOUND,
        target: null,
      };
    }

    if (target.stockMode === StockMode.INFINITE) {
      return {
        remainingQuantity: null,
        status: CHECKOUT_STOCK_DEDUCTION_STATUS.DEDUCTED,
        target,
      };
    }

    const applied = await this.applyLimitedDelta(transaction, target, -quantity, quantity);
    if (!applied) {
      return {
        remainingQuantity: target.quantity ?? 0,
        status: CHECKOUT_STOCK_DEDUCTION_STATUS.OUT_OF_STOCK,
        target,
      };
    }

    const updated = await this.findTarget(transaction, productId, variantId);
    if (!updated) {
      throw new Error("Inventory target disappeared after checkout deduction.");
    }

    await this.createHistory(transaction, {
      actorId: undefined,
      delta: -quantity,
      operation: InventoryOperation.SUBTRACT,
      origin: INVENTORY_ORIGIN.CHECKOUT,
      productId,
      quantity: updated.quantity,
      reason: "Checkout order placement",
      stockMode: updated.stockMode,
      variantId: updated.variantId,
    });

    return {
      remainingQuantity: updated.quantity,
      status: CHECKOUT_STOCK_DEDUCTION_STATUS.DEDUCTED,
      target: updated,
    };
  }

  async deductStockForCheckout(
    transaction: TransactionClient,
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ): Promise<CheckoutStockDeductionResult> {
    return this.deductForCheckout(transaction, productId, variantId, quantity);
  }

  async deductStockForItems(
    transaction: TransactionClient,
    items: readonly InventoryStockItem[],
    context: InventoryLedgerContext,
  ): Promise<InventoryLedgerMovement[]> {
    const movements: InventoryLedgerMovement[] = [];

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Inventory deductions require a positive integer quantity.");
      }

      const target = await this.findTarget(transaction, item.productId, item.variantId ?? undefined);
      if (!target) {
        throw new Error(`Inventory target ${item.productId}${item.variantId ? `/${item.variantId}` : ""} was not found.`);
      }

      if (target.stockMode === StockMode.INFINITE) continue;

      const applied = await this.applyLimitedDelta(transaction, target, -item.quantity, item.quantity);
      if (!applied) {
        throw new Error(`Insufficient inventory for ${item.productId}${item.variantId ? `/${item.variantId}` : ""}.`);
      }

      const updated = await this.findTarget(transaction, item.productId, item.variantId ?? undefined);
      if (!updated) throw new Error("Inventory target disappeared after deduction.");

      const movement = await this.createHistory(transaction, {
        actorId: context.actorId,
        delta: -item.quantity,
        inventoryEffectId: context.inventoryEffectId,
        movementKind: context.movementKind,
        operation: InventoryOperation.SUBTRACT,
        operationId: context.operationId,
        origin: context.origin,
        productId: updated.productId,
        quantity: updated.quantity,
        reason: context.reason,
        referenceId: context.referenceId,
        referenceType: context.referenceType,
        stockMode: updated.stockMode,
        variantId: updated.variantId,
      });

      movements.push({
        id: movement.id,
        productId: updated.productId,
        quantity: item.quantity,
        ...(updated.variantId ? { variantId: updated.variantId } : {}),
      });
    }

    return movements;
  }

  async restoreUncompensatedDeductions(
    transaction: TransactionClient,
    context: InventoryLedgerContext,
  ): Promise<InventoryLedgerMovement[]> {
    const deductions = await transaction.inventoryHistory.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        compensatedBy: null,
        inventoryEffectId: context.inventoryEffectId,
        operation: InventoryOperation.SUBTRACT,
      },
    });
    const restorations: InventoryLedgerMovement[] = [];

    for (const deduction of deductions) {
      if (!deduction.delta || deduction.delta >= 0) continue;

      const quantity = Math.abs(deduction.delta);
      const target = await this.findTarget(transaction, deduction.productId, deduction.variantId ?? undefined);
      if (!target || target.stockMode === StockMode.INFINITE) {
        throw new Error("Referenced inventory deduction target is incompatible with restoration.");
      }

      const targetId = target.kind === INVENTORY_TARGET_KIND.PRODUCT ? target.productId : target.variantId;
      const updated = target.stockMode === StockMode.OUT_OF_STOCK
        ? await this.restoreOutOfStockTarget(transaction, targetId, quantity, target.kind)
        : await this.incrementTrackedTarget(transaction, target, quantity);
      if (!updated) {
        throw new Error("Referenced inventory deduction target changed before restoration.");
      }

      const next = await this.findTarget(transaction, deduction.productId, deduction.variantId ?? undefined);
      if (!next) throw new Error("Inventory target disappeared after restoration.");

      const restoration = await this.createHistory(transaction, {
        actorId: context.actorId,
        compensatesMovementId: deduction.id,
        delta: quantity,
        inventoryEffectId: context.inventoryEffectId,
        movementKind: context.movementKind,
        operation: InventoryOperation.ADD,
        operationId: context.operationId,
        origin: context.origin,
        productId: next.productId,
        quantity: next.quantity,
        reason: context.reason,
        referenceId: context.referenceId,
        referenceType: context.referenceType,
        stockMode: next.stockMode,
        variantId: next.variantId,
      });

      restorations.push({
        id: restoration.id,
        productId: next.productId,
        quantity,
        ...(next.variantId ? { variantId: next.variantId } : {}),
      });
    }

    return restorations;
  }

  async reDeductLatestCompensatedDeductions(
    transaction: TransactionClient,
    context: InventoryLedgerContext,
  ): Promise<InventoryLedgerMovement[]> {
    const latestRestoration = await transaction.inventoryHistory.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: {
        compensatesMovementId: { not: null },
        inventoryEffectId: context.inventoryEffectId,
        operation: InventoryOperation.ADD,
      },
    });

    if (!latestRestoration?.operationId) return [];

    const restorations = await transaction.inventoryHistory.findMany({
      include: { compensatesMovement: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        compensatesMovementId: { not: null },
        inventoryEffectId: context.inventoryEffectId,
        operation: InventoryOperation.ADD,
        operationId: latestRestoration.operationId,
      },
    });
    const items = restorations.flatMap((restoration) => {
      const deduction = restoration.compensatesMovement;
      if (!deduction?.delta || deduction.delta >= 0) return [];
      return [{
        productId: deduction.productId,
        quantity: Math.abs(deduction.delta),
        ...(deduction.variantId ? { variantId: deduction.variantId } : {}),
      }];
    });

    return this.deductStockForItems(transaction, items, context);
  }

  async restoreStockForItems(
    transaction: TransactionClient,
    items: readonly InventoryStockItem[],
    options: Omit<InventoryIncrementOptions, "origin"> & { origin?: string } = {},
  ): Promise<void> {
    await this.incrementStockForItems(transaction, items, {
      ...options,
      origin: options.origin ?? INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION,
    });
  }

  async incrementStockForItems(
    transaction: TransactionClient,
    items: readonly InventoryStockItem[],
    options: InventoryIncrementOptions,
  ): Promise<void> {
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) continue;

      const target = await this.findTarget(transaction, item.productId, item.variantId ?? undefined);
      if (!target) {
        throw new Error(`Inventory target ${item.productId}${item.variantId ? `/${item.variantId}` : ""} was not found.`);
      }

      if (target.stockMode === StockMode.INFINITE) continue;

      const targetId = target.kind === INVENTORY_TARGET_KIND.PRODUCT ? target.productId : target.variantId;
      const updated = target.stockMode === StockMode.OUT_OF_STOCK
        ? await this.restoreOutOfStockTarget(transaction, targetId, item.quantity, target.kind)
        : await this.incrementTrackedTarget(transaction, target, item.quantity);

      if (!updated) {
        const current = await this.findTarget(transaction, item.productId, item.variantId ?? undefined);
        if (current?.stockMode === StockMode.INFINITE) continue;
        throw new Error(`Inventory target ${item.productId}${item.variantId ? `/${item.variantId}` : ""} changed before restoration.`);
      }

      const next = await this.findTarget(transaction, item.productId, item.variantId ?? undefined);
      if (!next) throw new Error("Inventory target disappeared after stock restoration.");

      await this.createHistory(transaction, {
        actorId: options.actorId,
        delta: item.quantity,
        operation: InventoryOperation.ADD,
        origin: options.origin,
        productId: next.productId,
        quantity: next.quantity,
        reason: options.reason,
        stockMode: next.stockMode,
        variantId: next.variantId,
      });
    }
  }

  async replaceState(
    transaction: TransactionClient,
    target: InventoryTarget,
    state: InventoryState,
  ): Promise<void> {
    const data = { quantity: state.quantity, stockMode: state.stockMode };

    if (target.kind === INVENTORY_TARGET_KIND.PRODUCT) {
      await transaction.product.update({ data, where: { id: target.productId } });
      return;
    }

    await transaction.productVariant.update({ data, where: { id: target.variantId } });
  }

  async createHistory(
    transaction: TransactionClient,
    input: CreateInventoryHistoryInput,
  ): Promise<{ id: string }> {
    return transaction.inventoryHistory.create({
      data: {
        actorId: input.actorId,
        compensatesMovementId: input.compensatesMovementId,
        delta: input.delta,
        inventoryEffectId: input.inventoryEffectId,
        movementKind: input.movementKind,
        operation: input.operation,
        operationId: input.operationId,
        origin: input.origin,
        productId: input.productId,
        reason: input.reason,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        resultingQuantity: input.quantity,
        stockMode: input.stockMode,
        variantId: input.variantId,
      },
    });
  }

  async historyPage(
    productId: string | undefined,
    variantId: string | undefined,
    skip: number,
    take: number,
  ): Promise<InventoryHistoryPageResult> {
    const where = {
      ...(productId ? { productId } : {}),
      ...(variantId ? { variantId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryHistory.findMany({
        include: {
          product: { select: { name: true } },
          variant: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        where,
      }),
      this.prisma.inventoryHistory.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        actorId: item.actorId ?? undefined,
        createdAt: item.createdAt,
        delta: item.delta ?? undefined,
        id: item.id,
        operation: item.operation,
        origin: item.origin,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.resultingQuantity,
        reason: item.reason ?? undefined,
        stockMode: item.stockMode,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.variant ? { variantName: item.variant.name } : {}),
      })),
      total,
    };
  }

  private async incrementTrackedTarget(
    transaction: TransactionClient,
    target: InventoryTarget,
    quantity: number,
  ): Promise<boolean> {
    const where = target.kind === INVENTORY_TARGET_KIND.PRODUCT
      ? { id: target.productId, stockMode: StockMode.TRACKED }
      : { id: target.variantId, productId: target.productId, stockMode: StockMode.TRACKED };
    const data = { quantity: { increment: quantity } };
    const result = target.kind === INVENTORY_TARGET_KIND.PRODUCT
      ? await transaction.product.updateMany({ data, where })
      : await transaction.productVariant.updateMany({ data, where });

    return result.count === 1;
  }

  private async restoreOutOfStockTarget(
    transaction: TransactionClient,
    targetId: string | undefined,
    quantity: number,
    kind: InventoryTargetKind,
  ): Promise<boolean> {
    if (!targetId) return false;

    const data = { quantity, stockMode: StockMode.TRACKED };
    const where = { id: targetId, stockMode: StockMode.OUT_OF_STOCK };
    const result = kind === INVENTORY_TARGET_KIND.PRODUCT
      ? await transaction.product.updateMany({ data, where })
      : await transaction.productVariant.updateMany({ data, where });

    return result.count === 1;
  }
}
