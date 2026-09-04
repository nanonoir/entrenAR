import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import { salesOrderInclude, type OrderHistoryRecord, type SalesOrderRecord } from "./sales.mapper";
import { SALE_SORT_BY, type CreateManualSale, type SalesListQuery } from "./sales.schemas";

export type TransactionClient = Prisma.TransactionClient;
export interface SalesPageResult { items: SalesOrderRecord[]; total: number; }
export interface CreateSaleItemRecord { attributes: Prisma.InputJsonValue; compareAtPrice?: number; lineSubtotal: number; productId: string; productName: string; quantity: number; sku: string; snapshot: Prisma.InputJsonValue; unitPrice: number; variantId?: string; variantName?: string; weightGrams?: number; }
export interface CreateSaleRecord { currency: string; customerDni?: string; customerEmail: string; customerFirstName: string; customerId?: string; customerLastName: string; customerPhone?: string; customerSnapshot: Prisma.InputJsonValue; deliverySnapshot: Prisma.InputJsonValue; deliveryType: OrderDeliveryType; discountAmount: number; discountSnapshot: Prisma.InputJsonValue; internalNotes?: string; items: readonly CreateSaleItemRecord[]; number: string; paymentMethodId: string; paymentMethodSnapshot: Prisma.InputJsonValue; paymentOptionId?: string; paymentStatus: PaymentStatus; shippingAddressSnapshot?: Prisma.InputJsonValue | null; shippingCost: number; shippingStatus?: OrderShippingStatus; sourceOrderId?: string; status: OrderStatus; subtotal: number; total: number; userId?: string; }
export interface AppendHistoryInput { actorId?: string; actorRole?: "CUSTOMER" | "ADMIN"; description?: string; metadata?: Prisma.InputJsonValue | null; orderId: string; title: string; type: OrderHistoryRecord["type"]; }

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> { return this.prisma.$transaction(callback); }
  async list(query: SalesListQuery): Promise<SalesPageResult> {
    const where = salesWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ include: salesOrderInclude, orderBy: salesOrderBy(query), skip: (query.page - 1) * query.limit, take: query.limit, where }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }
  async findById(id: string): Promise<SalesOrderRecord | null> { return this.findByIdIn(this.prisma, id); }
  async findByOrderNumber(number: string): Promise<SalesOrderRecord | null> { return this.prisma.order.findUnique({ include: salesOrderInclude, where: { number } }); }
  async findBySourceOrderId(sourceOrderId: string): Promise<SalesOrderRecord | null> { return this.prisma.order.findFirst({ include: salesOrderInclude, where: { sourceOrderId } }); }
  async findByIdentifier(identifier: string): Promise<SalesOrderRecord | null> { return this.findByIdentifierIn(this.prisma, identifier); }
  async findByIdInTransaction(transaction: TransactionClient, id: string): Promise<SalesOrderRecord | null> { return this.findByIdIn(transaction, id); }
  async findBySourceOrderIdInTransaction(transaction: TransactionClient, sourceOrderId: string): Promise<SalesOrderRecord | null> { return transaction.order.findFirst({ include: salesOrderInclude, where: { sourceOrderId } }); }
  async findByIdentifierInTransaction(transaction: TransactionClient, identifier: string): Promise<SalesOrderRecord | null> { return this.findByIdentifierIn(transaction, identifier); }
  async updateState(transaction: TransactionClient, orderId: string, data: Prisma.OrderUncheckedUpdateInput): Promise<SalesOrderRecord> {
    await transaction.order.update({ data, where: { id: orderId } });
    const order = await this.findByIdIn(transaction, orderId);
    if (!order) throw new Error("Updated sale was not found.");
    return order;
  }
  async updateStateIfCurrent(
    transaction: TransactionClient,
    orderId: string,
    expected: Pick<Prisma.OrderWhereInput, "isArchived" | "shippingStatus" | "status">,
    data: Prisma.OrderUncheckedUpdateInput,
  ): Promise<boolean> {
    const result = await transaction.order.updateMany({ data, where: { ...expected, id: orderId } });
    return result.count === 1;
  }
  async createManualSale(transaction: TransactionClient, input: CreateSaleRecord): Promise<SalesOrderRecord> {
    return transaction.order.create({
      data: {
        currency: input.currency, customerDni: input.customerDni ?? null, customerEmail: input.customerEmail, customerFirstName: input.customerFirstName, ...(input.customerId === undefined ? {} : { customerId: input.customerId }), customerLastName: input.customerLastName, customerPhone: input.customerPhone ?? null,
        customerSnapshot: input.customerSnapshot, deliverySnapshot: input.deliverySnapshot, deliveryType: input.deliveryType, discountAmount: input.discountAmount, discountSnapshot: input.discountSnapshot, ...(input.internalNotes === undefined ? {} : { internalNotes: input.internalNotes }),
        items: { create: input.items.map((item) => ({ attributes: item.attributes, compareAtPrice: item.compareAtPrice ?? null, lineSubtotal: item.lineSubtotal, productId: item.productId, productName: item.productName, quantity: item.quantity, sku: item.sku, snapshot: item.snapshot, unitPrice: item.unitPrice, variantId: item.variantId ?? null, variantName: item.variantName ?? null, weightGrams: item.weightGrams ?? null })) },
        number: input.number, payment: { create: { amount: input.total, currency: input.currency, paymentMethodId: input.paymentMethodId, paymentMethodSnapshot: input.paymentMethodSnapshot, paymentOptionId: input.paymentOptionId ?? null, status: input.paymentStatus } },
        ...(input.shippingAddressSnapshot === undefined ? {} : { shippingAddressSnapshot: input.shippingAddressSnapshot === null ? Prisma.JsonNull : input.shippingAddressSnapshot }), shippingCost: input.shippingCost, ...(input.shippingStatus === undefined ? {} : { shippingStatus: input.shippingStatus }),
        ...(input.sourceOrderId === undefined ? {} : { sourceOrderId: input.sourceOrderId }), status: input.status, subtotal: input.subtotal, total: input.total, ...(input.userId === undefined ? {} : { userId: input.userId }),
      },
      include: salesOrderInclude,
    });
  }
  async appendHistory(transaction: TransactionClient, input: AppendHistoryInput): Promise<OrderHistoryRecord> {
    return transaction.orderHistory.create({ data: { actorId: input.actorId ?? null, actorRole: input.actorRole ?? null, description: input.description ?? null, ...(input.metadata === undefined ? {} : { metadata: input.metadata === null ? Prisma.JsonNull : input.metadata }), orderId: input.orderId, title: input.title, type: input.type } });
  }
  async markOrderConverted(transaction: TransactionClient, orderId: string): Promise<boolean> {
    const result = await transaction.order.updateMany({ data: { status: OrderStatus.CONFIRMED }, where: { id: orderId, status: OrderStatus.PENDING } });
    return result.count === 1;
  }
  private async findByIdIn(client: TransactionClient | PrismaService, id: string): Promise<SalesOrderRecord | null> { return client.order.findUnique({ include: salesOrderInclude, where: { id } }); }
  private async findByIdentifierIn(client: TransactionClient | PrismaService, identifier: string): Promise<SalesOrderRecord | null> { return (await this.findByIdIn(client, identifier)) ?? client.order.findUnique({ include: salesOrderInclude, where: { number: identifier } }); }
}

export function salesWhere(query: SalesListQuery): Prisma.OrderWhereInput {
  return {
    ...(query.isArchived === undefined ? {} : { isArchived: query.isArchived }), ...(query.status === undefined ? {} : { status: query.status }), ...(query.shippingStatus === undefined ? {} : { shippingStatus: query.shippingStatus }), ...(query.paymentStatus === undefined ? {} : { payment: { is: { status: query.paymentStatus } } }),
    ...(query.dateRange === undefined ? {} : { createdAt: { gte: startOfDay(query.dateRange.from), lte: endOfDay(query.dateRange.to) } }), ...(query.search === undefined ? {} : { OR: [
      { number: { contains: query.search, mode: "insensitive" } }, { customerEmail: { contains: query.search, mode: "insensitive" } }, { customerFirstName: { contains: query.search, mode: "insensitive" } }, { customerLastName: { contains: query.search, mode: "insensitive" } }, { sourceOrderId: { contains: query.search, mode: "insensitive" } }, { items: { some: { productName: { contains: query.search, mode: "insensitive" } } } },
    ] }),
  };
}

export function salesOrderBy(query: SalesListQuery): Prisma.OrderOrderByWithRelationInput[] {
  const direction = query.sortOrder;
  if (query.sortBy === SALE_SORT_BY.CUSTOMER_NAME) return [{ customerLastName: direction }, { customerFirstName: direction }, { id: direction }];
  return [{ [query.sortBy]: direction } as Prisma.OrderOrderByWithRelationInput, { id: direction }];
}

export function manualSaleRecord(input: CreateManualSale, number: string): CreateSaleRecord {
  return {
    currency: input.currency, customerDni: input.customer.dni, customerEmail: input.customer.email, customerFirstName: input.customer.firstName, ...(input.customerId === undefined ? {} : { customerId: input.customerId }), customerLastName: input.customer.lastName, customerPhone: input.customer.phone, customerSnapshot: inputJson(input.customer), deliverySnapshot: inputJson(input.deliverySnapshot), deliveryType: input.deliveryType,
    discountAmount: input.discountAmount, discountSnapshot: inputJson(input.discountSnapshot), ...(input.internalNotes === undefined ? {} : { internalNotes: input.internalNotes }), items: input.items.map((item) => ({ attributes: inputJson(item.attributes), ...(item.compareAtPrice === undefined ? {} : { compareAtPrice: item.compareAtPrice }), lineSubtotal: item.lineSubtotal, productId: item.productId, productName: item.productName, quantity: item.quantity, sku: item.sku, snapshot: inputJson(item.snapshot), unitPrice: item.unitPrice, ...(item.variantId === undefined ? {} : { variantId: item.variantId }), ...(item.variantName === undefined ? {} : { variantName: item.variantName }), ...(item.weightGrams === undefined ? {} : { weightGrams: item.weightGrams }) })), number,
    paymentMethodId: input.paymentMethodId, paymentMethodSnapshot: inputJson(input.paymentMethodSnapshot), ...(input.paymentOptionId === undefined ? {} : { paymentOptionId: input.paymentOptionId }), paymentStatus: input.paymentStatus, ...(input.shippingAddress === undefined ? {} : { shippingAddressSnapshot: inputJson(input.shippingAddress) }), shippingCost: input.shippingCost, ...(input.deliveryType === OrderDeliveryType.PICKUP ? { shippingStatus: OrderShippingStatus.PICKUP } : {}), status: OrderStatus.CONFIRMED, subtotal: input.subtotal, total: input.total,
  };
}

function inputJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function startOfDay(value: Date): Date { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; }
function endOfDay(value: Date): Date { const date = new Date(value); date.setUTCHours(23, 59, 59, 999); return date; }
