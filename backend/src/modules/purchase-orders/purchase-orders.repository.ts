import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import type { CreatePurchaseOrderDto, PurchaseOrderFilterQueryDto } from "./purchase-orders.schemas";

export const purchaseOrderInclude = { items: { orderBy: [{ productId: "asc" }, { id: "asc" }] }, supplier: true } satisfies Prisma.PurchaseOrderInclude;
export type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{ include: typeof purchaseOrderInclude }>;
export interface PurchaseOrderPageResult { items: PurchaseOrderRecord[]; total: number; }
export type TransactionClient = Prisma.TransactionClient;
export interface PurchaseOrderMoneyItem { productId: string; quantity: number; sku: string; title: string; totalCost: Prisma.Decimal; unitCost: Prisma.Decimal; variantId?: string | null; }
export interface PurchaseOrderCreateRecord extends Omit<CreatePurchaseOrderDto, "items" | "orderNumber" | "tax" | "shippingCost"> { items: readonly PurchaseOrderMoneyItem[]; orderNumber: string; status: PurchaseOrderStatus; subtotal: Prisma.Decimal; total: Prisma.Decimal; tax: Prisma.Decimal; shippingCost: Prisma.Decimal; }
export interface PurchaseOrderUpdateRecord { expectedDate: Date | null; items: readonly PurchaseOrderMoneyItem[]; notes: string | null; orderNumber: string; shippingCost: Prisma.Decimal; subtotal: Prisma.Decimal; supplierId: string; tax: Prisma.Decimal; total: Prisma.Decimal; }

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> { return this.prisma.$transaction(callback); }
  async list(query: PurchaseOrderFilterQueryDto): Promise<PurchaseOrderPageResult> {
    const where = purchaseOrderWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({ include: purchaseOrderInclude, orderBy: purchaseOrderOrderBy(query), skip: (query.page - 1) * query.limit, take: query.limit, where }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { items, total };
  }
  async findById(id: string): Promise<PurchaseOrderRecord | null> { return this.findByIdIn(this.prisma, id); }
  async findByIdInTransaction(transaction: TransactionClient, id: string): Promise<PurchaseOrderRecord | null> { return this.findByIdIn(transaction, id); }
  async create(transaction: TransactionClient, data: PurchaseOrderCreateRecord): Promise<PurchaseOrderRecord> {
    return transaction.purchaseOrder.create({ data: { expectedDate: data.expectedDate ?? null, items: { create: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity, sku: item.sku, title: item.title, totalCost: item.totalCost, unitCost: item.unitCost, variantId: item.variantId ?? null })) }, notes: data.notes ?? null, orderNumber: data.orderNumber, shippingCost: data.shippingCost, status: data.status, subtotal: data.subtotal, supplierId: data.supplierId, tax: data.tax, total: data.total }, include: purchaseOrderInclude });
  }
  async update(transaction: TransactionClient, id: string, input: PurchaseOrderUpdateRecord, expectedUpdatedAt: Date): Promise<PurchaseOrderRecord | null> {
    const result = await transaction.purchaseOrder.updateMany({
      data: { expectedDate: input.expectedDate, notes: input.notes, orderNumber: input.orderNumber, shippingCost: input.shippingCost, subtotal: input.subtotal, supplierId: input.supplierId, tax: input.tax, total: input.total },
      where: { id, status: PurchaseOrderStatus.DRAFT, updatedAt: expectedUpdatedAt },
    });
    if (result.count !== 1) return null;
    await transaction.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    await transaction.purchaseOrderItem.createMany({ data: input.items.map((item) => ({ productId: item.productId, purchaseOrderId: id, quantity: item.quantity, sku: item.sku, title: item.title, totalCost: item.totalCost, unitCost: item.unitCost, variantId: item.variantId ?? null })) });
    return this.findByIdIn(transaction, id);
  }
  async updateStatus(transaction: TransactionClient, id: string, status: PurchaseOrderStatus, receivedAt?: Date | null): Promise<PurchaseOrderRecord> {
    await transaction.purchaseOrder.update({ data: { status, ...(receivedAt === undefined ? {} : { receivedAt }) }, where: { id } });
    return this.findByIdIn(transaction, id).then((record) => { if (!record) throw new Error("Updated purchase order was not found."); return record; });
  }
  async updateStatusIfCurrent(transaction: TransactionClient, id: string, expected: PurchaseOrderStatus, status: PurchaseOrderStatus, receivedAt?: Date | null): Promise<boolean> {
    const result = await transaction.purchaseOrder.updateMany({ data: { status, ...(receivedAt === undefined ? {} : { receivedAt }) }, where: { id, status: expected } });
    return result.count === 1;
  }
  private async findByIdIn(client: TransactionClient | PrismaService, id: string): Promise<PurchaseOrderRecord | null> { return client.purchaseOrder.findUnique({ include: purchaseOrderInclude, where: { id } }); }
}

export function purchaseOrderWhere(query: PurchaseOrderFilterQueryDto): Prisma.PurchaseOrderWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}), ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.search ? { OR: [
      { orderNumber: { contains: query.search, mode: "insensitive" } }, { notes: { contains: query.search, mode: "insensitive" } },
      { supplier: { is: { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { name: { contains: query.search, mode: "insensitive" } }] } } },
      { items: { some: { OR: [{ sku: { contains: query.search, mode: "insensitive" } }, { title: { contains: query.search, mode: "insensitive" } }] } } },
    ] } : {}),
  };
}

export function purchaseOrderOrderBy(query: PurchaseOrderFilterQueryDto): Prisma.PurchaseOrderOrderByWithRelationInput[] {
  return [{ [query.sortBy]: query.sortOrder } as Prisma.PurchaseOrderOrderByWithRelationInput, { id: query.sortOrder }];
}
