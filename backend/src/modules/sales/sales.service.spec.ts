import {
  OrderDeliveryType,
  OrderHistoryEventType,
  OrderShippingStatus,
  OrderStatus,
  Role,
} from "../../generated/prisma/enums";
import { InventoryRepository } from "../inventory/inventory.repository";
import { SalesRepository, type TransactionClient } from "./sales.repository";
import { SalesService } from "./sales.service";
import { cancelSaleSchema, createManualSaleSchema } from "./sales.schemas";
import { toAdminSaleDetailDto, type SalesOrderRecord } from "./sales.mapper";

describe("SalesService", () => {
  it("executes a valid transition and appends its audit event atomically", async () => {
    const harness = createHarness();
    const current = makeOrder({ shippingStatus: OrderShippingStatus.TO_PACK });
    const updated = makeOrder({ shippingStatus: OrderShippingStatus.TO_SHIP, packedAt: new Date() });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(current);
    harness.repository.updateState.mockResolvedValue(updated);
    harness.repository.findByIdInTransaction.mockResolvedValue(updated);

    await expect(harness.service.pack(current.id, { id: "admin-1", role: Role.ADMIN })).resolves.toEqual(toAdminSaleDetailDto(updated));
    expect(harness.repository.updateState).toHaveBeenCalledWith(
      expect.anything(),
      current.id,
      expect.objectContaining({ shippingStatus: OrderShippingStatus.TO_SHIP }),
    );
    expect(harness.repository.appendHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: "admin-1",
      type: OrderHistoryEventType.PACKAGE_PACKED,
    }));
  });

  it("rejects an invalid transition before updating state or history", async () => {
    const harness = createHarness();
    const current = makeOrder({ shippingStatus: OrderShippingStatus.TO_PACK });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(current);

    await expect(harness.service.ship(current.id, { carrier: "Carrier", trackingCode: "TRACK-1" })).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.updateState).not.toHaveBeenCalled();
    expect(harness.repository.appendHistory).not.toHaveBeenCalled();
  });

  it("restores stock through the transaction when cancellation requests it", async () => {
    const harness = createHarness();
    const current = makeOrder();
    const updated = makeOrder({
      cancellationReason: "Customer request",
      shippingStatus: OrderShippingStatus.CANCELLED,
      status: OrderStatus.CANCELLED,
    });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(current);
    harness.repository.updateStateIfCurrent.mockResolvedValue(true);
    harness.repository.findByIdInTransaction.mockResolvedValue(updated);

    const input = cancelSaleSchema.parse({ cancellationReason: "Customer request", restoreStock: true });
    await harness.service.cancel(current.id, input);

    expect(harness.inventoryRepository.restoreStockForItems).toHaveBeenCalledWith(
      expect.anything(),
      current.items,
      expect.objectContaining({
        actorId: undefined,
        origin: "admin_sales_cancellation",
      }),
    );
    expect(harness.repository.appendHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      metadata: { restoreStock: true },
      type: OrderHistoryEventType.ORDER_CANCELLED,
    }));
  });

  it("cancels without touching inventory when restoration is disabled", async () => {
    const harness = createHarness();
    const current = makeOrder();
    const updated = makeOrder({ shippingStatus: OrderShippingStatus.CANCELLED, status: OrderStatus.CANCELLED });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(current);
    harness.repository.updateStateIfCurrent.mockResolvedValue(true);
    harness.repository.findByIdInTransaction.mockResolvedValue(updated);

    await harness.service.cancel(current.id, cancelSaleSchema.parse({ cancellationReason: "Customer request", restoreStock: false }));

    expect(harness.inventoryRepository.restoreStockForItems).not.toHaveBeenCalled();
    expect(harness.repository.appendHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      metadata: { restoreStock: false },
      type: OrderHistoryEventType.ORDER_CANCELLED,
    }));
  });

  it("rejects a duplicate cancellation before updating state, history, or inventory", async () => {
    const harness = createHarness();
    const current = makeOrder({ shippingStatus: OrderShippingStatus.CANCELLED, status: OrderStatus.CANCELLED });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(current);

    await expect(harness.service.cancelSale(current.id, cancelSaleSchema.parse({ cancellationReason: "Retry", restoreStock: true }))).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.updateStateIfCurrent).not.toHaveBeenCalled();
    expect(harness.repository.appendHistory).not.toHaveBeenCalled();
    expect(harness.inventoryRepository.restoreStockForItems).not.toHaveBeenCalled();
  });

  it("creates a manual confirmed sale from immutable input snapshots", async () => {
    const harness = createHarness();
    const created = makeOrder({ status: OrderStatus.CONFIRMED });
    harness.repository.createManualSale.mockResolvedValue(created);
    harness.repository.findByIdInTransaction.mockResolvedValue(created);

    const input = createManualSaleSchema.parse({
      customer: { email: "customer@example.com", firstName: "Test", lastName: "Customer" },
      items: [{ name: "Product", productId: "product-1", quantity: 1, unitPrice: 100 }],
      subtotal: 100,
      total: 100,
    });
    await expect(harness.service.createManualSale(input)).resolves.toEqual(toAdminSaleDetailDto(created));
    expect(harness.repository.createManualSale).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      customerEmail: "customer@example.com",
      status: OrderStatus.CONFIRMED,
    }));
    expect(harness.repository.appendHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: OrderHistoryEventType.ORDER_CREATED,
    }));
  });

  it("converts a pending source order once and preserves its origin", async () => {
    const harness = createHarness();
    const source = makeOrder({ id: "draft-1", status: OrderStatus.PENDING });
    const sale = makeOrder({ id: "sale-2", sourceOrderId: source.id, status: OrderStatus.CONFIRMED });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(source);
    harness.repository.findBySourceOrderIdInTransaction.mockResolvedValue(null);
    harness.repository.markOrderConverted.mockResolvedValue(true);
    harness.repository.createManualSale.mockResolvedValue(sale);
    harness.repository.findByIdInTransaction.mockResolvedValue(sale);

    await expect(harness.service.convertOrderToSale({ sourceOrderId: source.id })).resolves.toEqual(toAdminSaleDetailDto(sale));
    expect(harness.repository.markOrderConverted).toHaveBeenCalledWith(expect.anything(), source.id);
    expect(harness.repository.createManualSale).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceOrderId: source.id }));
    expect(harness.repository.appendHistory).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      orderId: source.id,
      type: OrderHistoryEventType.ORDER_CONVERTED,
    }));
    expect(harness.repository.appendHistory).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
      metadata: { sourceOrderId: source.id },
      orderId: sale.id,
      type: OrderHistoryEventType.ORDER_CREATED,
    }));
  });

  it("rejects conversion when the source already has a sale", async () => {
    const harness = createHarness();
    const source = makeOrder({ id: "draft-1", status: OrderStatus.PENDING });
    const existingSale = makeOrder({ id: "sale-2", sourceOrderId: source.id, status: OrderStatus.CONFIRMED });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(source);
    harness.repository.findBySourceOrderIdInTransaction.mockResolvedValue(existingSale);

    await expect(harness.service.convertOrderToSale({ sourceOrderId: source.id })).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.markOrderConverted).not.toHaveBeenCalled();
    expect(harness.repository.createManualSale).not.toHaveBeenCalled();
    expect(harness.repository.appendHistory).not.toHaveBeenCalled();
  });

  it("rejects conversion from a non-pending source order", async () => {
    const harness = createHarness();
    const source = makeOrder({ id: "confirmed-1", status: OrderStatus.CONFIRMED });
    harness.repository.findByIdentifierInTransaction.mockResolvedValue(source);
    harness.repository.findBySourceOrderIdInTransaction.mockResolvedValue(null);

    await expect(harness.service.convertOrderToSale({ orderId: source.id })).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.markOrderConverted).not.toHaveBeenCalled();
    expect(harness.repository.createManualSale).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const repository = { appendHistory: jest.fn(), createManualSale: jest.fn(), findByIdentifierInTransaction: jest.fn(), findByIdInTransaction: jest.fn(), findBySourceOrderIdInTransaction: jest.fn(), list: jest.fn(), markOrderConverted: jest.fn(), updateState: jest.fn(), updateStateIfCurrent: jest.fn(), transaction: jest.fn((callback: (transaction: TransactionClient) => Promise<unknown>) => callback({} as TransactionClient)) };
  const inventoryRepository = { restoreStockForItems: jest.fn() };
  return { inventoryRepository, repository, service: new SalesService(repository as unknown as SalesRepository, inventoryRepository as unknown as InventoryRepository) };
}

function makeOrder(overrides: Partial<SalesOrderRecord> = {}): SalesOrderRecord {
  return { id: "sale-1", number: "EN-SALE-1", status: OrderStatus.CONFIRMED, shippingStatus: OrderShippingStatus.TO_PACK, deliveryType: OrderDeliveryType.SHIPPING, isArchived: false, currency: "ARS", customerEmail: "customer@example.com", customerFirstName: "Test", customerLastName: "Customer", customerSnapshot: {}, deliverySnapshot: {}, discountSnapshot: {}, subtotal: 0, discountAmount: 0, shippingCost: 0, total: 0, createdAt: new Date("2026-09-03T00:00:00.000Z"), updatedAt: new Date("2026-09-03T00:00:00.000Z"), items: [], history: [], payment: null, ...overrides } as unknown as SalesOrderRecord;
}
