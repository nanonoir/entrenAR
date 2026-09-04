import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import type { CreatePurchaseOrderDto, PurchaseOrderFilterQueryDto, UpdatePurchaseOrderDto } from "./purchase-orders.schemas";

export const purchaseOrderInclude = { items: { orderBy: [{ productId: "asc" }, { id: "asc" }] }, supplier: true } satisfies Prisma.PurchaseOrderInclude;
export type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{ include: typeof purchaseOrderInclude }>;
export interface PurchaseOrderPageResult { items: PurchaseOrderRecord[]; total: number; }
export type TransactionClient = Prisma.TransactionClient;
export interface PurchaseOrderCreateRecord extends Omit<CreatePurchaseOrderDto, "items" | "orderNumber" | "subtotal" | "total"> { items: readonly CreatePurchaseOrderDto["items"][number][]; orderNumber: string; status: PurchaseOrderStatus; subtotal: number; total: number; }

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
  async update(transaction: TransactionClient, id: string, input: UpdatePurchaseOrderDto): Promise<PurchaseOrderRecord> {
    const items = input.items;
    const data: Prisma.PurchaseOrderUncheckedUpdateInput = {
      ...(input.expectedDate === undefined ? {} : { expectedDate: input.expectedDate }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
      ...(input.shippingCost === undefined ? {} : { shippingCost: input.shippingCost }),
      ...(input.subtotal === undefined ? {} : { subtotal: input.subtotal }),
      ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
      ...(input.tax === undefined ? {} : { tax: input.tax }),
      ...(input.total === undefined ? {} : { total: input.total }),
    };
    await transaction.purchaseOrder.update({ data, where: { id } });
    if (items) {
      await transaction.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await transaction.purchaseOrderItem.createMany({ data: items.map((item) => ({ productId: item.productId, purchaseOrderId: id, quantity: item.quantity, sku: item.sku, title: item.title, totalCost: item.totalCost, unitCost: item.unitCost, variantId: item.variantId ?? null })) });
    }
    return this.findByIdIn(transaction, id).then((record) => { if (!record) throw new Error("Updated purchase order was not found."); return record; });
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
