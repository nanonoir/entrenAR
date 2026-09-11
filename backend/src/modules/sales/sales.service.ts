import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { addMoney, multiplyMoney, normalizeMoney, subtractMoney } from "../../common/money/money.utils";
import { Prisma } from "../../generated/prisma/client";
import { InventoryMovementKind, InventoryReferenceType, OrderDeliveryType, OrderInventoryPolicy, OrderShippingStatus, OrderStatus, PaymentStatus, Role } from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { InventoryRepository } from "../inventory/inventory.repository";
import { toAdminSaleDetailDto, toAdminSaleSummaryDto, type AdminSaleDetailDto, type AdminSaleSummaryDto, type SalesOrderRecord } from "./sales.mapper";
import { manualSaleRecord, SalesRepository, type AppendHistoryInput, type CreateSaleRecord, type ManualSaleCalculatedValues, type TransactionClient } from "./sales.repository";
import { SALE_COMMAND, type AddSaleNote, type CancelSale, type ConvertOrderToSale, type CreateManualSale, type SalesCommand, type SalesListQuery, type ShipSale } from "./sales.schemas";
import { resolveHistoryEventType, SaleTransitionError, transitionSale, type SaleState, type SaleTransitionOptions } from "./sales.state-machine";

export interface SalesActor { id?: string; role?: Role; }
export interface SalesPageDto { items: AdminSaleSummaryDto[]; limit: number; page: number; total: number; }
type LifecycleCommand = Exclude<SalesCommand, { type: typeof SALE_COMMAND.ADD_NOTE } | { type: typeof SALE_COMMAND.MANUAL_CREATE } | { type: typeof SALE_COMMAND.CONVERT_ORDER_TO_SALE }>;

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly inventoryRepository: InventoryRepository,
  ) {}
  async list(query: SalesListQuery): Promise<SalesPageDto> { const page = await this.salesRepository.list(query); return { items: page.items.map(toAdminSaleSummaryDto), limit: query.limit, page: query.page, total: page.total }; }
  async get(identifier: string): Promise<AdminSaleDetailDto> { const order = await this.salesRepository.findByIdentifier(identifier); if (!order) throw this.notFound(); return toAdminSaleDetailDto(order); }
  async detail(identifier: string): Promise<AdminSaleDetailDto> { return this.get(identifier); }
  async execute(identifier: string, command: SalesCommand, actor?: SalesActor): Promise<AdminSaleDetailDto> {
    if (command.type === SALE_COMMAND.ADD_NOTE) return this.addNote(identifier, command.payload, actor);
    if (command.type === SALE_COMMAND.MANUAL_CREATE) return this.createManualSale(command.payload, actor);
    if (command.type === SALE_COMMAND.CONVERT_ORDER_TO_SALE) return this.convertOrderToSale(command.payload, actor);
    return this.executeLifecycle(identifier, command, actor);
  }
  async executeCommand(identifier: string, command: SalesCommand, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.execute(identifier, command, actor); }
  async confirm(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.CONFIRM }, actor); }
  async pack(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.PACK }, actor); }
  async unpack(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.UNPACK }, actor); }
  async ship(identifier: string, input: ShipSale, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: input, type: SALE_COMMAND.SHIP }, actor); }
  async deliver(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.DELIVER }, actor); }
  async cancel(identifier: string, input: CancelSale, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.cancelSale(identifier, input, actor); }
  async cancelSale(identifier: string, input: CancelSale, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: input, type: SALE_COMMAND.CANCEL }, actor); }
  async reopen(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.REOPEN }, actor); }
  async archive(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.ARCHIVE }, actor); }
  async unarchive(identifier: string, actor?: SalesActor): Promise<AdminSaleDetailDto> { return this.executeLifecycle(identifier, { payload: {}, type: SALE_COMMAND.UNARCHIVE }, actor); }

  async addNote(identifier: string, input: AddSaleNote, actor?: SalesActor): Promise<AdminSaleDetailDto> {
    return this.salesRepository.transaction(async (transaction) => {
      const order = await this.orderOrThrow(transaction, identifier);
      if (order.isArchived) throw this.conflict("Archived sales cannot receive notes.");
      await this.salesRepository.updateState(transaction, order.id, { internalNotes: order.internalNotes ? `${order.internalNotes}\n${input.note}` : input.note });
      await this.appendEvent(transaction, order.id, SALE_COMMAND.ADD_NOTE, actor, input.note);
      return this.currentDetail(transaction, order.id);
    });
  }

  async createManualSale(input: CreateManualSale, actor?: SalesActor): Promise<AdminSaleDetailDto> {
    return this.salesRepository.transaction(async (transaction) => {
      const calculated = calculateManualSale(input);
      const order = await this.salesRepository.createManualSale(transaction, manualSaleRecord(input, manualNumber(), calculated));
      const inventoryEffectId = randomUUID();
      try {
        const movements = await this.inventoryRepository.deductStockForItems(transaction, input.items, {
          actorId: actor?.id,
          inventoryEffectId,
          movementKind: InventoryMovementKind.SALE_DEDUCTION,
          operationId: randomUUID(),
          origin: INVENTORY_ORIGIN.ADMIN_MANUAL,
          reason: `Manual sale ${order.number}`,
          referenceId: order.id,
          referenceType: InventoryReferenceType.ORDER,
        });
        await this.salesRepository.assignInventoryOwnership(transaction, order.id, movements.length > 0 ? inventoryEffectId : undefined);
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        throw this.outOfStock("Manual sale inventory is insufficient or unavailable.");
      }
      await this.appendEvent(transaction, order.id, SALE_COMMAND.MANUAL_CREATE, actor, "Manual sale created.", input.source ? { source: input.source } : undefined);
      return this.currentDetail(transaction, order.id);
    });
  }

  async convertOrderToSale(input: ConvertOrderToSale, actor?: SalesActor): Promise<AdminSaleDetailDto> {
    const identifier = input.sourceOrderId ?? input.orderId;
    if (!identifier) throw this.conflict("A source order is required for conversion.");
    return this.salesRepository.transaction(async (transaction) => {
      const source = await this.orderOrThrow(transaction, identifier);
      if (await this.salesRepository.findBySourceOrderIdInTransaction(transaction, source.id)) throw this.conflict("The source order has already been converted into a sale.");
      if (source.status !== OrderStatus.PENDING) throw this.conflict("Only pending orders can be converted into sales.");
      const converted = convertedSaleRecord(source);
      if (source.inventoryPolicy === OrderInventoryPolicy.LEDGER_MANAGED) {
        if (!source.inventoryEffectId) throw this.conflict("Ledger-managed orders require an inventory effect before conversion.");
        if (!await this.salesRepository.transferInventoryOwnership(transaction, source.id, source.inventoryEffectId)) {
          throw this.conflict("The source order changed before inventory ownership could be transferred.");
        }
        converted.inventoryEffectId = source.inventoryEffectId;
        converted.inventoryPolicy = OrderInventoryPolicy.LEDGER_MANAGED;
      } else if (!await this.salesRepository.markOrderConverted(transaction, source.id)) {
        throw this.conflict("The source order has already been converted into a sale.");
      }
      const sale = await this.salesRepository.createManualSale(transaction, converted);
      await this.appendEvent(transaction, source.id, SALE_COMMAND.CONVERT_ORDER_TO_SALE, actor, `Order ${source.number} converted to sale.`);
      await this.appendEvent(transaction, sale.id, SALE_COMMAND.MANUAL_CREATE, actor, `Sale created from order ${source.number}.`, { sourceOrderId: source.id });
      return this.currentDetail(transaction, sale.id);
    });
  }

  private async executeLifecycle(identifier: string, command: LifecycleCommand, actor?: SalesActor): Promise<AdminSaleDetailDto> {
    return this.salesRepository.transaction(async (transaction) => {
      const order = await this.orderOrThrow(transaction, identifier);
      if (command.type === SALE_COMMAND.CANCEL && order.status === OrderStatus.CANCELLED) {
        throw this.conflict("Sale is already cancelled.");
      }
      let transition;
      try { transition = transitionSale(toSaleState(order), command.type, transitionOptions(command)); }
      catch (error) { if (error instanceof SaleTransitionError) throw this.conflict(error.message); throw error; }
      if (command.type === SALE_COMMAND.CONFIRM) {
        if (!order.payment) throw this.conflict("Sale cannot be confirmed without a payment record.");
        if (order.payment.status === PaymentStatus.PAID) throw this.conflict("Sale payment has already been received.");
        if (order.payment.status === PaymentStatus.REFUNDED) throw this.conflict("Refunded payments cannot be confirmed.");
        const claimed = await this.salesRepository.confirmPaymentIfCurrent(transaction, order.id, order.status, transition.patch);
        if (!claimed) throw this.conflict("Sale payment changed before confirmation could be completed.");
      } else if (command.type === SALE_COMMAND.CANCEL) {
        if (command.payload.restoreStock) this.assertInventoryChangeAllowed(order);
        const claimed = await this.salesRepository.updateStateIfCurrent(
          transaction,
          order.id,
          { isArchived: order.isArchived, shippingStatus: order.shippingStatus, status: order.status },
          transition.patch,
        );
        if (!claimed) throw this.conflict("Sale changed before cancellation could be completed.");
        if (command.payload.restoreStock && order.inventoryPolicy === OrderInventoryPolicy.LEDGER_MANAGED) {
          await this.inventoryRepository.restoreUncompensatedDeductions(transaction, {
            actorId: actor?.id,
            inventoryEffectId: order.inventoryEffectId!,
            movementKind: InventoryMovementKind.SALE_CANCELLATION_RESTORATION,
            operationId: randomUUID(),
            origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION,
            reason: `Sale ${order.number} cancellation`,
            referenceId: order.id,
            referenceType: InventoryReferenceType.ORDER,
          });
        }
      } else if (command.type === SALE_COMMAND.REOPEN) {
        this.assertInventoryChangeAllowed(order);
        const claimed = await this.salesRepository.updateStateIfCurrent(
          transaction,
          order.id,
          { isArchived: order.isArchived, shippingStatus: order.shippingStatus, status: order.status },
          transition.patch,
        );
        if (!claimed) throw this.conflict("Sale changed before reopening could be completed.");
        if (order.inventoryPolicy === OrderInventoryPolicy.LEDGER_MANAGED) {
          await this.inventoryRepository.reDeductLatestCompensatedDeductions(transaction, {
            actorId: actor?.id,
            inventoryEffectId: order.inventoryEffectId!,
            movementKind: InventoryMovementKind.SALE_REOPEN_DEDUCTION,
            operationId: randomUUID(),
            origin: INVENTORY_ORIGIN.ADMIN_SALES_REOPEN,
            reason: `Sale ${order.number} reopen`,
            referenceId: order.id,
            referenceType: InventoryReferenceType.ORDER,
          });
        }
      } else {
        await this.salesRepository.updateState(transaction, order.id, transition.patch);
      }
      await this.appendEvent(transaction, order.id, command.type, actor, eventDescription(command), eventMetadata(command));
      return this.currentDetail(transaction, order.id);
    });
  }
  private async orderOrThrow(transaction: TransactionClient, identifier: string): Promise<SalesOrderRecord> { const order = await this.salesRepository.findByIdentifierInTransaction(transaction, identifier); if (!order) throw this.notFound(); return order; }
  private async currentDetail(transaction: TransactionClient, id: string): Promise<AdminSaleDetailDto> { const order = await this.salesRepository.findByIdInTransaction(transaction, id); if (!order) throw new Error("Sale disappeared during its transaction."); return toAdminSaleDetailDto(order); }
  private async appendEvent(transaction: TransactionClient, orderId: string, command: SalesCommand["type"], actor: SalesActor | undefined, description?: string, metadata?: Record<string, unknown>): Promise<void> {
    const input: AppendHistoryInput = { actorId: actor?.id, actorRole: actor?.role ?? Role.ADMIN, description, ...(metadata ? { metadata: jsonInput(metadata) } : {}), orderId, title: eventTitle(command), type: resolveHistoryEventType(command) };
    await this.salesRepository.appendHistory(transaction, input);
  }
  private assertInventoryChangeAllowed(order: SalesOrderRecord): void {
    if (order.inventoryPolicy === OrderInventoryPolicy.UNKNOWN || order.inventoryPolicy === OrderInventoryPolicy.TRANSFERRED) {
      throw this.conflict("Inventory policy must be reconciled before this lifecycle command can change inventory.");
    }
    if (order.inventoryPolicy === OrderInventoryPolicy.LEDGER_MANAGED && !order.inventoryEffectId) {
      throw this.conflict("Ledger-managed orders require an inventory effect.");
    }
  }
  private notFound(): NotFoundException { return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested sale was not found.", ok: false }); }
  private conflict(message: string): ConflictException { return new ConflictException({ code: ERROR_CODE.CONFLICT, message, ok: false }); }
  private outOfStock(message: string): ConflictException { return new ConflictException({ code: ERROR_CODE.OUT_OF_STOCK, message, ok: false }); }
}

function toSaleState(order: SalesOrderRecord): SaleState { return { confirmedAt: order.confirmedAt, deliveryType: order.deliveryType, isArchived: order.isArchived, paymentStatus: order.payment?.status ?? null, previousPaymentStatus: order.previousPaymentStatus, previousShippingStatus: order.previousShippingStatus, previousStatus: order.previousStatus, shippingStatus: order.shippingStatus, status: order.status }; }
function transitionOptions(command: LifecycleCommand): SaleTransitionOptions { return command.type === SALE_COMMAND.CANCEL ? { cancellationReason: command.payload.cancellationReason } : command.type === SALE_COMMAND.SHIP ? command.payload : {}; }
function eventDescription(command: LifecycleCommand): string | undefined { return command.type === SALE_COMMAND.CANCEL ? `Cancellation reason: ${command.payload.cancellationReason}` : command.type === SALE_COMMAND.SHIP ? `Tracking ${command.payload.trackingCode} via ${command.payload.carrier}.` : undefined; }
function eventMetadata(command: LifecycleCommand): Record<string, unknown> | undefined { return command.type === SALE_COMMAND.CANCEL ? { restoreStock: command.payload.restoreStock } : command.type === SALE_COMMAND.SHIP ? { carrier: command.payload.carrier, trackingCode: command.payload.trackingCode } : undefined; }
function eventTitle(command: SalesCommand["type"]): string { const titles: Record<SalesCommand["type"], string> = { ADD_NOTE: "Sale note added", ARCHIVE: "Sale archived", CANCEL: "Sale cancelled", CONFIRM: "Sale confirmed", CONVERT_ORDER_TO_SALE: "Order converted to sale", DELIVER: "Sale delivered", MANUAL_CREATE: "Sale created", PACK: "Package packed", REOPEN: "Sale reopened", SHIP: "Package shipped", UNARCHIVE: "Sale unarchived", UNPACK: "Package unpacked" }; return titles[command]; }

function convertedSaleRecord(source: SalesOrderRecord): CreateSaleRecord {
  return { confirmedAt: new Date(), currency: source.currency, customerDni: source.customerDni ?? undefined, customerEmail: source.customerEmail, customerFirstName: source.customerFirstName, ...(source.customerId ? { customerId: source.customerId } : {}), customerLastName: source.customerLastName, customerPhone: source.customerPhone ?? undefined, customerSnapshot: jsonInput(source.customerSnapshot), deliverySnapshot: jsonInput(source.deliverySnapshot), deliveryType: source.deliveryType, discountAmount: decimal(source.discountAmount), discountSnapshot: jsonInput(source.discountSnapshot), ...(source.internalNotes ? { internalNotes: source.internalNotes } : {}), items: source.items.map((item) => ({ attributes: jsonInput(item.attributes), ...(item.compareAtPrice === null ? {} : { compareAtPrice: decimal(item.compareAtPrice) }), lineSubtotal: decimal(item.lineSubtotal), productId: item.productId, productName: item.productName, quantity: item.quantity, sku: item.sku, snapshot: jsonInput(item.snapshot), unitPrice: decimal(item.unitPrice), ...(item.variantId ? { variantId: item.variantId } : {}), ...(item.variantName ? { variantName: item.variantName } : {}), ...(item.weightGrams === null ? {} : { weightGrams: item.weightGrams }) })), number: manualNumber(), paymentMethodId: source.payment?.paymentMethodId ?? "manual", paymentMethodSnapshot: jsonInput(source.payment?.paymentMethodSnapshot ?? {}), ...(source.payment?.paymentOptionId ? { paymentOptionId: source.payment.paymentOptionId } : {}), paymentStatus: source.payment?.status ?? PaymentStatus.PENDING, ...(source.shippingAddressSnapshot == null ? {} : { shippingAddressSnapshot: jsonInput(source.shippingAddressSnapshot) }), shippingCost: decimal(source.shippingCost), shippingStatus: OrderShippingStatus.TO_PACK, sourceOrderId: source.id, status: OrderStatus.CONFIRMED, subtotal: decimal(source.subtotal), total: decimal(source.total), ...(source.userId ? { userId: source.userId } : {}) };
}

function calculateManualSale(input: CreateManualSale): ManualSaleCalculatedValues {
  const items = input.items.map((item) => ({ lineSubtotal: multiplyMoney(item.unitPrice, item.quantity) }));
  const subtotal = items.reduce((sum, item) => addMoney(sum, item.lineSubtotal), normalizeMoney(0));
  const discountAmount = normalizeMoney(input.discountAmount);
  const shippingCost = input.deliveryType === OrderDeliveryType.PICKUP ? normalizeMoney(0) : normalizeMoney(input.shippingCost);

  if (discountAmount.greaterThan(subtotal)) {
    throw new BadRequestException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Manual sale discount cannot exceed its subtotal.", ok: false });
  }

  const total = addMoney(subtractMoney(subtotal, discountAmount), shippingCost);
  return { discountAmount, items, shippingCost, subtotal, total };
}
function jsonInput(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function decimal(value: { toString(): string } | number): number { return Number(value); }
function manualNumber(): string { return `MANUAL-${randomUUID()}`; }
