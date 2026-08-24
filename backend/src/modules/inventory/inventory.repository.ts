import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { InventoryOperation, StockMode } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
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
  ): Promise<void> {
    await transaction.inventoryHistory.create({
      data: {
        actorId: input.actorId,
        delta: input.delta,
        operation: input.operation,
        origin: input.origin,
        productId: input.productId,
        reason: input.reason,
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
}
