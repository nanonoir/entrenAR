import {
  toAddSaleNotePayload,
  toCancelSalePayload,
  toConvertOrderToSalePayload,
  toCreateManualSalePayload,
  toCreatePurchaseOrderPayload,
  toCreateSupplierPayload,
  toShipSalePayload,
  toUpdateSupplierPayload,
} from "./sales-api.payloads";
import type {
  AdminSaleDetail,
  CancelSalePayload,
  ConvertOrderToSalePayload,
  CreateManualSalePayload,
  CreatePurchaseOrderPayload,
  CreateSupplierPayload,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderFilterQuery,
  PaginatedSalesResult,
  SalesFilterQuery,
  SalesRepository,
  ShipSalePayload,
  Supplier,
  SupplierFilterQuery,
  UpdateSupplierPayload,
} from "./sales.repository";
import {
  mockPurchaseOrders,
  mockSales,
} from "@/lib/data/admin/sales-flow";
import {
  backendStatus,
  clonePurchaseOrder,
  cloneSale,
  cloneSupplier,
  compareSales,
  compareValues,
  conflictError,
  createSaleFromOrder,
  createSaleFromRequest,
  matchesPurchaseOrder,
  matchesSale,
  matchesSupplier,
  makeEvent,
  MOCK_SUPPLIERS,
  notFoundError,
  parsePurchaseOrderQuery,
  parseSalesQuery,
  parseSupplierQuery,
  purchaseOrderSortValue,
  supplierSortValue,
  toMockPurchaseOrder,
  toMockSaleDetail,
  toMockSaleSummary,
} from "./mock-sales.repository.helpers";
import { generateNextSaleId, generatePurchaseOrderId } from "@/lib/data/admin/sales-flow/helpers";
import type { AdminPurchaseOrder, AdminSale } from "@/lib/data/admin/sales-flow/types";
import { isSaleArchivable } from "@/lib/data/admin/sales-flow/archive";

export class MockSalesRepository implements SalesRepository {
  readonly source = "mock" as const;

  private sales: AdminSaleDetail[];
  private suppliers: Supplier[];
  private purchaseOrders: PurchaseOrder[];

  constructor(
    initialSales: readonly AdminSale[] = mockSales,
    initialPurchaseOrders: readonly AdminPurchaseOrder[] = mockPurchaseOrders,
    initialSuppliers: readonly Supplier[] = MOCK_SUPPLIERS,
  ) {
    this.sales = initialSales.map(toMockSaleDetail);
    this.purchaseOrders = initialPurchaseOrders.map(toMockPurchaseOrder);
    this.suppliers = initialSuppliers.map(cloneSupplier);
  }

  async getSales(query: SalesFilterQuery = {}): Promise<PaginatedSalesResult> {
    const normalized = parseSalesQuery(query);
    const filtered = this.sales
      .filter((sale) => matchesSale(sale, normalized))
      .sort((left, right) => compareSales(left, right, normalized));
    const page = normalized.page ?? 1;
    const limit = normalized.limit ?? 20;
    return {
      items: filtered.slice((page - 1) * limit, page * limit).map(toMockSaleSummary),
      limit,
      page,
      total: filtered.length,
    };
  }

  async getSaleById(id: string): Promise<AdminSaleDetail> {
    return cloneSale(this.findSale(id));
  }

  async createManualSale(payload: CreateManualSalePayload): Promise<AdminSaleDetail> {
    const input = toCreateManualSalePayload(payload);
    const sale = createSaleFromRequest(input, generateNextSaleId(this.sales));
    this.sales = [...this.sales, sale];
    return cloneSale(sale);
  }

  async convertOrderToSale(payload: ConvertOrderToSalePayload): Promise<AdminSaleDetail> {
    const input = toConvertOrderToSalePayload(payload);
    const order = this.findPurchaseOrder(input.sourceOrderId ?? input.orderId ?? "");
    if (order.status === "converted" || order.backendStatus === "RECEIVED") {
      throw conflictError("The source order has already been converted into a sale.");
    }
    if (order.status === "cancelled" || order.backendStatus === "CANCELLED") {
      throw conflictError("Only pending orders can be converted into sales.");
    }

    const sale = createSaleFromOrder(order, generateNextSaleId(this.sales));
    order.status = "converted";
    order.backendStatus = "RECEIVED";
    order.convertedSaleId = sale.id;
    this.sales = [...this.sales, sale];
    return cloneSale(sale);
  }

  async confirmSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (sale.backendStatus === "CANCELLED") throw conflictError("Cancelled sales must be reopened before confirmation.");
      sale.backendStatus = "CONFIRMED";
      sale.status = "confirmed";
      sale.history.push(makeEvent("sale_updated", "Sale confirmed."));
    });
  }

  async packSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (sale.shippingStatus !== "to_pack") throw conflictError("Only sales waiting to be packed can be packed.");
      sale.shippingStatus = sale.deliveryType === "pickup" ? "pickup" : "to_ship";
      sale.packedAt = new Date().toISOString();
      sale.history.push(makeEvent("package_packed"));
    });
  }

  async unpackSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (sale.shippingStatus !== "to_ship") throw conflictError("Only packed sales can be unpacked.");
      sale.shippingStatus = "to_pack";
      sale.packedAt = undefined;
      sale.history.push(makeEvent("package_unpacked"));
    });
  }

  async shipSale(id: string, payload: ShipSalePayload): Promise<AdminSaleDetail> {
    const input = toShipSalePayload(payload);
    return this.updateSale(id, (sale) => {
      if (sale.shippingStatus !== "to_ship") throw conflictError("Only packed sales can be shipped.");
      sale.shippingStatus = "shipped";
      sale.trackingCode = input.trackingCode;
      sale.shippingCarrier = input.carrier;
      sale.shippingTrackingUrl = input.trackingUrl;
      sale.shippedAt = new Date().toISOString();
      sale.history.push(makeEvent("package_shipped", `Tracking ${input.trackingCode} via ${input.carrier}.`));
    });
  }

  async deliverSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (sale.shippingStatus !== "shipped") throw conflictError("Only shipped sales can be delivered.");
      sale.shippingStatus = "delivered";
      sale.deliveredAt = new Date().toISOString();
      sale.history.push(makeEvent("sale_updated", "Sale delivered."));
    });
  }

  async cancelSale(id: string, payload: CancelSalePayload): Promise<AdminSaleDetail> {
    const input = toCancelSalePayload(payload);
    return this.updateSale(id, (sale) => {
      if (sale.shippingStatus === "cancelled" || sale.paymentStatus === "cancelled") throw conflictError("Sale is already cancelled.");
      if (sale.shippingStatus === "delivered") throw conflictError("Delivered sales cannot be cancelled.");
      sale.previousPaymentStatus = sale.paymentStatus;
      sale.previousShippingStatus = sale.shippingStatus;
      sale.paymentStatus = "cancelled";
      sale.shippingStatus = "cancelled";
      sale.backendStatus = "CANCELLED";
      sale.status = "cancelled";
      sale.cancellationReason = input.cancellationReason;
      sale.history.push(makeEvent("sale_cancelled", `Cancellation reason: ${input.cancellationReason}`));
    });
  }

  async reopenSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (sale.backendStatus !== "CANCELLED") throw conflictError("Only cancelled sales can be reopened.");
      sale.paymentStatus = sale.previousPaymentStatus ?? "pending";
      sale.shippingStatus = sale.previousShippingStatus ?? "to_pack";
      sale.backendStatus = "CONFIRMED";
      sale.status = "confirmed";
      sale.history.push(makeEvent("sale_reopened"));
    });
  }

  async archiveSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (!isSaleArchivable(sale)) throw conflictError("Only cancelled, refunded, or delivered paid sales can be archived.");
      if (sale.archived) throw conflictError("Sale is already archived.");
      sale.archived = true;
      sale.history.push(makeEvent("sale_archived"));
    });
  }

  async unarchiveSale(id: string): Promise<AdminSaleDetail> {
    return this.updateSale(id, (sale) => {
      if (!sale.archived) throw conflictError("Sale is not archived.");
      sale.archived = false;
      sale.history.push(makeEvent("sale_updated", "Sale unarchived."));
    });
  }

  async addNote(id: string, note: string): Promise<AdminSaleDetail> {
    const input = toAddSaleNotePayload(note);
    return this.updateSale(id, (sale) => {
      if (sale.archived) throw conflictError("Archived sales cannot receive notes.");
      sale.notes = sale.notes ? `${sale.notes}\n${input.note}` : input.note;
      sale.internalNotes = sale.notes;
      sale.history.push(makeEvent("sale_updated", input.note));
    });
  }

  async getSuppliers(query: SupplierFilterQuery = {}): Promise<Supplier[]> {
    const normalized = parseSupplierQuery(query);
    const filtered = this.suppliers
      .filter((supplier) => matchesSupplier(supplier, normalized))
      .sort((left, right) => compareValues(supplierSortValue(left, normalized.sortBy), supplierSortValue(right, normalized.sortBy), normalized.sortOrder)
        || compareValues(left.id, right.id, normalized.sortOrder));
    const page = normalized.page ?? 1;
    const limit = normalized.limit ?? 20;
    return filtered.slice((page - 1) * limit, page * limit).map(cloneSupplier);
  }

  async createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
    const input = toCreateSupplierPayload(payload);
    if (this.suppliers.some((supplier) => supplier.code === input.code)) throw conflictError("Supplier code is already in use.");
    const timestamp = new Date().toISOString();
    const supplier: Supplier = {
      code: input.code,
      ...(input.contactName === undefined || input.contactName === null ? {} : { contactName: input.contactName }),
      createdAt: timestamp,
      ...(input.email === undefined || input.email === null ? {} : { email: input.email }),
      id: `supplier-${Date.now()}`,
      name: input.name,
      ...(input.notes === undefined || input.notes === null ? {} : { notes: input.notes }),
      ...(input.phone === undefined || input.phone === null ? {} : { phone: input.phone }),
      status: input.status === "INACTIVE" ? "inactive" : "active",
      updatedAt: timestamp,
    };
    this.suppliers = [...this.suppliers, supplier];
    return cloneSupplier(supplier);
  }

  async updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier> {
    const input = toUpdateSupplierPayload(payload);
    const supplier = this.findSupplier(id);
    if (input.code && this.suppliers.some((entry) => entry.id !== id && entry.code === input.code)) throw conflictError("Supplier code is already in use.");
    Object.assign(supplier, {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.contactName === undefined ? {} : { contactName: input.contactName ?? undefined }),
      ...(input.email === undefined ? {} : { email: input.email ?? undefined }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.notes === undefined ? {} : { notes: input.notes ?? undefined }),
      ...(input.phone === undefined ? {} : { phone: input.phone ?? undefined }),
      ...(input.status === undefined ? {} : { status: input.status === "ACTIVE" ? "active" : "inactive" }),
      updatedAt: new Date().toISOString(),
    });
    return cloneSupplier(supplier);
  }

  async toggleSupplierStatus(id: string): Promise<Supplier> {
    const supplier = this.findSupplier(id);
    supplier.status = supplier.status === "active" ? "inactive" : "active";
    supplier.updatedAt = new Date().toISOString();
    return cloneSupplier(supplier);
  }

  async getPurchaseOrders(query: PurchaseOrderFilterQuery = {}): Promise<PurchaseOrder[]> {
    const normalized = parsePurchaseOrderQuery(query);
    const filtered = this.purchaseOrders
      .filter((order) => matchesPurchaseOrder(order, normalized))
      .sort((left, right) => compareValues(purchaseOrderSortValue(left, normalized.sortBy), purchaseOrderSortValue(right, normalized.sortBy), normalized.sortOrder)
        || compareValues(left.id, right.id, normalized.sortOrder));
    const page = normalized.page ?? 1;
    const limit = normalized.limit ?? 20;
    return filtered.slice((page - 1) * limit, page * limit).map(clonePurchaseOrder);
  }

  async getPurchaseOrderById(id: string): Promise<PurchaseOrderDetail> {
    return clonePurchaseOrder(this.findPurchaseOrder(id));
  }

  async createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDetail> {
    const input = toCreatePurchaseOrderPayload(payload);
    const supplier = this.findSupplier(input.supplierId);
    const timestamp = new Date().toISOString();
    const order: PurchaseOrder = {
      id: generatePurchaseOrderId(),
      createdAt: timestamp,
      source: supplier.name,
      customer: { firstName: supplier.name, lastName: "", ...(supplier.email ? { email: supplier.email } : {}) },
      products: input.items.map((item) => ({ productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}), name: item.title, quantity: item.quantity, unitPrice: item.unitCost })),
      status: "pending",
      subtotal: input.subtotal,
      shippingCost: input.shippingCost,
      total: input.total,
      ...(input.notes === undefined || input.notes === null ? {} : { notes: input.notes }),
      history: [],
      supplier: cloneSupplier(supplier),
      supplierId: input.supplierId,
      orderNumber: input.orderNumber ?? generatePurchaseOrderId(),
      backendStatus: "DRAFT",
      ...(input.expectedDate === undefined || input.expectedDate === null ? {} : { expectedDate: input.expectedDate }),
      tax: input.tax,
      updatedAt: timestamp,
    };
    this.purchaseOrders = [...this.purchaseOrders, order];
    return clonePurchaseOrder(order);
  }

  async submitPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const order = this.findPurchaseOrder(id);
    if (backendStatus(order) !== "DRAFT") throw conflictError("Only draft purchase orders can be submitted.");
    order.backendStatus = "ORDERED";
    order.updatedAt = new Date().toISOString();
    return clonePurchaseOrder(order);
  }

  async receivePurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const order = this.findPurchaseOrder(id);
    if (backendStatus(order) !== "ORDERED") throw conflictError("Only ordered purchase orders can be received.");
    order.backendStatus = "RECEIVED";
    order.status = "converted";
    order.receivedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    return clonePurchaseOrder(order);
  }

  async cancelPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const order = this.findPurchaseOrder(id);
    if (backendStatus(order) === "RECEIVED") throw conflictError("Received purchase orders cannot be cancelled.");
    if (backendStatus(order) === "CANCELLED") throw conflictError("Purchase order is already cancelled.");
    order.backendStatus = "CANCELLED";
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    return clonePurchaseOrder(order);
  }

  private updateSale(id: string, updater: (sale: AdminSaleDetail) => void): AdminSaleDetail {
    const index = this.sales.findIndex((sale) => sale.id === id || sale.number === id);
    if (index < 0) throw notFoundError("sale");
    const sale = cloneSale(this.sales[index]!);
    updater(sale);
    sale.updatedAt = new Date().toISOString();
    this.sales = this.sales.map((entry, entryIndex) => entryIndex === index ? sale : entry);
    return cloneSale(sale);
  }

  private findSale(id: string): AdminSaleDetail {
    const sale = this.sales.find((entry) => entry.id === id || entry.number === id);
    if (!sale) throw notFoundError("sale");
    return sale;
  }

  private findSupplier(id: string): Supplier {
    const supplier = this.suppliers.find((entry) => entry.id === id);
    if (!supplier) throw notFoundError("supplier");
    return supplier;
  }

  private findPurchaseOrder(id: string): PurchaseOrder {
    const order = this.purchaseOrders.find((entry) => entry.id === id || entry.orderNumber === id);
    if (!order) throw notFoundError("purchase order");
    return order;
  }
}
