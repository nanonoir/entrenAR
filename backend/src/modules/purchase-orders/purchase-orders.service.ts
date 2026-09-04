import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { InventoryRepository } from "../inventory/inventory.repository";
import { toSupplierResponse } from "../suppliers/suppliers.service";
import { PURCHASE_ORDER_COMMAND, type CreatePurchaseOrderDto, type PurchaseOrderFilterQueryDto, type PurchaseOrderListResponseDto, type PurchaseOrderResponseDto, type UpdatePurchaseOrderDto } from "./purchase-orders.schemas";
import { PurchaseOrdersRepository, type PurchaseOrderRecord, type TransactionClient } from "./purchase-orders.repository";
import { assertPurchaseOrderEditable, transitionPurchaseOrder } from "./purchase-orders.state-machine";

export interface PurchaseOrderActor { id?: string; }

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly purchaseOrdersRepository: PurchaseOrdersRepository, private readonly inventoryRepository: InventoryRepository) {}
  async list(query: PurchaseOrderFilterQueryDto): Promise<PurchaseOrderListResponseDto> { const page = await this.purchaseOrdersRepository.list(query); return { items: page.items.map(toPurchaseOrderResponse), limit: query.limit, page: query.page, total: page.total }; }
  async get(id: string): Promise<PurchaseOrderResponseDto> { const record = await this.purchaseOrdersRepository.findById(id); if (!record) throw this.notFound(); return toPurchaseOrderResponse(record); }
  async create(input: CreatePurchaseOrderDto): Promise<PurchaseOrderResponseDto> {
    return this.purchaseOrdersRepository.transaction(async (transaction) => toPurchaseOrderResponse(await this.purchaseOrdersRepository.create(transaction, createRecord(input))));
  }
  async update(id: string, input: UpdatePurchaseOrderDto): Promise<PurchaseOrderResponseDto>;
  async update(input: UpdatePurchaseOrderDto & { id: string }): Promise<PurchaseOrderResponseDto>;
  async update(idOrInput: string | UpdatePurchaseOrderDto, input?: UpdatePurchaseOrderDto): Promise<PurchaseOrderResponseDto> {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const changes = typeof idOrInput === "string" ? input ?? {} : idOrInput;
    if (!id) throw this.notFound();
    return this.purchaseOrdersRepository.transaction(async (transaction) => {
      const current = await this.currentOrThrow(transaction, id);
      try { assertPurchaseOrderEditable(current); } catch (error) { throw this.conflict(error instanceof Error ? error.message : "Purchase order cannot be edited."); }
      return toPurchaseOrderResponse(await this.purchaseOrdersRepository.update(transaction, id, changes));
    });
  }
  async submit(id: string): Promise<PurchaseOrderResponseDto> { return this.transition(id, PURCHASE_ORDER_COMMAND.SUBMIT); }
  async receive(id: string, actor?: PurchaseOrderActor): Promise<PurchaseOrderResponseDto> {
    return this.purchaseOrdersRepository.transaction(async (transaction) => {
      const current = await this.currentOrThrow(transaction, id);
      const next = this.transitionOrConflict(current, PURCHASE_ORDER_COMMAND.RECEIVE);
      if (!await this.purchaseOrdersRepository.updateStatusIfCurrent(transaction, id, PurchaseOrderStatus.ORDERED, next.status, next.receivedAt)) throw this.conflict("Purchase order changed before receipt could be completed.");
      await this.inventoryRepository.incrementStockForItems(transaction, current.items.map((item) => ({ productId: item.productId, quantity: item.quantity, variantId: item.variantId })), { actorId: actor?.id, origin: INVENTORY_ORIGIN.PURCHASE_ORDER, reason: `Purchase order ${current.orderNumber} receipt` });
      return toPurchaseOrderResponse(await this.currentOrThrow(transaction, id));
    });
  }
  async cancel(id: string): Promise<PurchaseOrderResponseDto> { return this.transition(id, PURCHASE_ORDER_COMMAND.CANCEL); }
  async submitPurchaseOrder(id: string): Promise<PurchaseOrderResponseDto> { return this.submit(id); }
  async receivePurchaseOrder(id: string, actor?: PurchaseOrderActor): Promise<PurchaseOrderResponseDto> { return this.receive(id, actor); }
  async cancelPurchaseOrder(id: string): Promise<PurchaseOrderResponseDto> { return this.cancel(id); }
  private async transition(id: string, command: typeof PURCHASE_ORDER_COMMAND.SUBMIT | typeof PURCHASE_ORDER_COMMAND.CANCEL): Promise<PurchaseOrderResponseDto> {
    return this.purchaseOrdersRepository.transaction(async (transaction) => {
      const current = await this.currentOrThrow(transaction, id);
      const next = this.transitionOrConflict(current, command);
      if (!await this.purchaseOrdersRepository.updateStatusIfCurrent(transaction, id, current.status, next.status, next.receivedAt)) throw this.conflict("Purchase order changed before its status could be updated.");
      return toPurchaseOrderResponse(await this.currentOrThrow(transaction, id));
    });
  }
  private async currentOrThrow(transaction: TransactionClient, id: string): Promise<PurchaseOrderRecord> { const record = await this.purchaseOrdersRepository.findByIdInTransaction(transaction, id); if (!record) throw this.notFound(); return record; }
  private transitionOrConflict(record: PurchaseOrderRecord, command: typeof PURCHASE_ORDER_COMMAND[keyof typeof PURCHASE_ORDER_COMMAND]) { try { return transitionPurchaseOrder(record, command); } catch (error) { throw this.conflict(error instanceof Error ? error.message : "Purchase order transition is not allowed."); } }
  private notFound(): NotFoundException { return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested purchase order was not found.", ok: false }); }
  private conflict(message: string): ConflictException { return new ConflictException({ code: ERROR_CODE.CONFLICT, message, ok: false }); }
}

export function toPurchaseOrderResponse(record: PurchaseOrderRecord): PurchaseOrderResponseDto {
  return { createdAt: record.createdAt.toISOString(), expectedDate: record.expectedDate?.toISOString() ?? null, id: record.id, items: record.items.map((item) => ({ productId: item.productId, quantity: item.quantity, sku: item.sku, title: item.title, totalCost: money(item.totalCost), unitCost: money(item.unitCost), variantId: item.variantId })), notes: record.notes, orderNumber: record.orderNumber, receivedAt: record.receivedAt?.toISOString() ?? null, shippingCost: money(record.shippingCost), status: record.status, subtotal: money(record.subtotal), supplier: toSupplierResponse(record.supplier), supplierId: record.supplierId, tax: money(record.tax), total: money(record.total), updatedAt: record.updatedAt.toISOString() };
}

function createRecord(input: CreatePurchaseOrderDto) {
  const subtotal = input.subtotal ?? input.items.reduce((sum, item) => sum + item.totalCost, 0);
  return { ...input, orderNumber: input.orderNumber ?? `PO-${randomUUID()}`, status: PurchaseOrderStatus.DRAFT, subtotal, total: input.total ?? subtotal + input.tax + input.shippingCost };
}
function money(value: { toString(): string } | number): number { const result = Number(value); if (!Number.isFinite(result)) throw new Error("Purchase-order money values must serialize to finite numbers."); return result; }
