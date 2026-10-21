import { ERROR_CODE } from "../../common/errors/api-error.response";
import { OrderDeliveryType, OrderInventoryPolicy, OrderShippingStatus, OrderStatus, PaymentAttemptStatus, PaymentProvider, PaymentStatus } from "../../generated/prisma/enums";
import { InventoryRepository } from "../inventory/inventory.repository";
import { toAdminSaleDetailDto, toAdminSaleSummaryDto, type SalesOrderRecord } from "./sales.mapper";
import { assertCancellationAllowed, assertFulfillmentAllowed } from "./sales.payment-guards";
import { SalesRepository, type TransactionClient } from "./sales.repository";
import { SalesService } from "./sales.service";

type Payment = NonNullable<SalesOrderRecord["payment"]>;
const ADMIN = { id: "admin-1" };

describe("provider-managed sales guards", () => {
  it.each([
    ["confirm", (s: SalesService) => s.confirm("sale-1"), PaymentStatus.PENDING, OrderStatus.PENDING],
    ["confirm of an already paid order", (s: SalesService) => s.confirm("sale-1"), PaymentStatus.PAID, OrderStatus.CONFIRMED],
    ["reopen", (s: SalesService) => s.reopen("sale-1"), PaymentStatus.REFUNDED, OrderStatus.CANCELLED],
    ["conversion to manual sale", (s: SalesService) => s.convertOrderToSale({ orderId: "sale-1" }), PaymentStatus.PENDING, OrderStatus.PENDING],
  ])("rejects %s with PAYMENT_PROVIDER_MANAGED and writes nothing", async (_name, run, paymentStatus, status) => {
    const h = createHarness();
    h.repository.findByIdentifierInTransaction.mockResolvedValue(mpOrder({ status }, { status: paymentStatus }));
    h.repository.findByIdInTransaction.mockResolvedValue(mpOrder({ status }, { status: paymentStatus }));

    await expect(run(h.service)).rejects.toMatchObject({ response: { code: ERROR_CODE.PAYMENT_PROVIDER_MANAGED }, status: 409 });
    expect(h.repository.confirmPaymentIfCurrent).not.toHaveBeenCalled();
    expect(h.repository.updateStateIfCurrent).not.toHaveBeenCalled();
    expect(h.repository.markOrderConverted).not.toHaveBeenCalled();
    expect(h.repository.appendHistory).not.toHaveBeenCalled();
  });

  it("takes the shared order/payment lock before evaluating a provider-managed command", async () => {
    const h = createHarness();
    h.repository.findByIdentifierInTransaction.mockResolvedValue(mpOrder());
    h.repository.findByIdInTransaction.mockResolvedValue(mpOrder());
    await expect(h.service.confirm("sale-1")).rejects.toMatchObject({ status: 409 });
    expect(h.repository.lockOrderAndPayment).toHaveBeenCalledWith(expect.anything(), "sale-1");
  });

  it("keeps transfer confirm working and never locks non-provider orders", async () => {
    const h = createHarness();
    const transfer = makeOrder({ status: OrderStatus.PENDING, payment: { ...basePayment(), provider: null, status: PaymentStatus.PENDING } as unknown as Payment });
    const confirmed = makeOrder({ status: OrderStatus.CONFIRMED, payment: { ...basePayment(), provider: null, status: PaymentStatus.PAID } as unknown as Payment });
    h.repository.findByIdentifierInTransaction.mockResolvedValue(transfer);
    h.repository.confirmPaymentIfCurrent.mockResolvedValue(true);
    h.repository.findByIdInTransaction.mockResolvedValue(confirmed);

    await expect(h.service.confirm("sale-1", ADMIN)).resolves.toMatchObject({ status: OrderStatus.CONFIRMED });
    expect(h.repository.lockOrderAndPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["pack", (s: SalesService) => s.pack("sale-1"), { shippingStatus: OrderShippingStatus.TO_PACK }],
    ["ship", (s: SalesService) => s.ship("sale-1", { carrier: "C", trackingCode: "T" }), { shippingStatus: OrderShippingStatus.TO_SHIP }],
    ["deliver", (s: SalesService) => s.deliver("sale-1"), { shippingStatus: OrderShippingStatus.SHIPPED }],
  ])("blocks %s when the payment is unverified, held or fully refunded", async (_name, run, order) => {
    for (const payment of [
      { status: PaymentStatus.PENDING }, { status: PaymentStatus.REFUNDED, fulfillmentHoldReasons: ["full_refund"] }, { status: PaymentStatus.CHARGED_BACK },
      { status: PaymentStatus.PAID, fulfillmentHoldReasons: ["dispute"] }, { status: PaymentStatus.PAID, fulfillmentHoldReasons: ["fraud_alert"] }, { status: PaymentStatus.PAID, fulfillmentHoldReasons: ["unverified_provider_state"] },
    ]) {
      const h = createHarness();
      h.repository.findByIdentifierInTransaction.mockResolvedValue(mpOrder(order, payment));
      await expect(run(h.service)).rejects.toMatchObject({ response: { code: ERROR_CODE.PAYMENT_FULFILLMENT_BLOCKED } });
      expect(h.repository.updateState).not.toHaveBeenCalled();
    }
  });

  it("lets pack proceed for PAID and for PARTIALLY_REFUNDED without a hold", async () => {
    for (const status of [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]) {
      const h = createHarness();
      const order = mpOrder({ shippingStatus: OrderShippingStatus.TO_PACK }, { refundedAmount: 10, status });
      h.repository.findByIdentifierInTransaction.mockResolvedValue(order);
      h.repository.updateState.mockResolvedValue(order);
      h.repository.findByIdInTransaction.mockResolvedValue(order);
      await expect(h.service.pack("sale-1", ADMIN)).resolves.toMatchObject({ id: "sale-1" });
      expect(h.repository.updateState).toHaveBeenCalledWith(expect.anything(), "sale-1", expect.objectContaining({ shippingStatus: OrderShippingStatus.TO_SHIP }));
    }
  });

  it("does not guard unpack so an operator can always step back", () => {
    expect(() => assertFulfillmentAllowed(makeOrder())).not.toThrow();
  });

  describe("cancellation", () => {
    const cancel = (s: SalesService, restoreStock = true) => s.cancel("sale-1", { cancellationReason: "reason", restoreStock }, ADMIN);

    it.each([PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.CHARGED_BACK])("rejects cancelling a %s order with panel refund instructions", async (status) => {
      const h = createHarness();
      h.repository.findByIdentifierInTransaction.mockResolvedValue(mpOrder({}, { status }));
      await expect(cancel(h.service)).rejects.toMatchObject({ response: { code: ERROR_CODE.PAYMENT_REFUND_REQUIRED, message: expect.stringContaining("Mercado Pago panel") } });
      expect(h.repository.updateStateIfCurrent).not.toHaveBeenCalled();
      expect(h.inventoryRepository.restoreUncompensatedDeductions).not.toHaveBeenCalled();
    });

    it.each(Object.values(PaymentAttemptStatus).filter((s) => ["SUBMITTING", "UNKNOWN", "PROCESSING", "ACTION_REQUIRED"].includes(s)))("rejects cancelling while an attempt is %s", async (attemptStatus) => {
      const h = createHarness();
      h.repository.findByIdentifierInTransaction.mockResolvedValue(mpOrder({ status: OrderStatus.PENDING }, { attempts: [attempt(attemptStatus)], status: PaymentStatus.PENDING }));
      await expect(cancel(h.service)).rejects.toMatchObject({ response: { code: ERROR_CODE.PAYMENT_ATTEMPT_ACTIVE } });
      expect(h.inventoryRepository.restoreUncompensatedDeductions).not.toHaveBeenCalled();
    });

    it("rejects cancelling a fully refunded order while the provider state is unverified", () => {
      expect(() => assertCancellationAllowed(mpOrder({}, { fulfillmentHoldReasons: ["unverified_provider_state"], status: PaymentStatus.REFUNDED }))).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: ERROR_CODE.PAYMENT_REFUND_REQUIRED }) }));
    });

    it.each([true, false])("cancels a verified fully refunded order once, preserving REFUNDED (restoreStock=%s)", async (restoreStock) => {
      const h = createHarness();
      const order = mpOrder({ inventoryEffectId: "effect-1", inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED }, { attempts: [attempt(PaymentAttemptStatus.REFUNDED)], fulfillmentHoldReasons: ["full_refund"], refundedAmount: 100, status: PaymentStatus.REFUNDED });
      h.repository.findByIdentifierInTransaction.mockResolvedValue(order);
      h.repository.updateStateIfCurrent.mockResolvedValue(true);
      h.repository.findByIdInTransaction.mockResolvedValue(order);

      await cancel(h.service, restoreStock);

      expect(h.repository.updateStateIfCurrent).toHaveBeenCalledTimes(1);
      expect(h.repository.updateStateIfCurrent.mock.calls[0]![3]).not.toHaveProperty("payment");
      expect(h.inventoryRepository.restoreUncompensatedDeductions).toHaveBeenCalledTimes(restoreStock ? 1 : 0);
      expect(h.repository.appendHistory).toHaveBeenCalledTimes(1);
    });

    it("allows cancelling an unpaid order whose attempts are all conclusively closed", async () => {
      const h = createHarness();
      const order = mpOrder({ status: OrderStatus.PENDING }, { attempts: [attempt(PaymentAttemptStatus.REJECTED)], status: PaymentStatus.PENDING });
      h.repository.findByIdentifierInTransaction.mockResolvedValue(order);
      h.repository.updateStateIfCurrent.mockResolvedValue(true);
      h.repository.findByIdInTransaction.mockResolvedValue(order);
      await expect(cancel(h.service, false)).resolves.toMatchObject({ id: "sale-1" });
    });

    it("keeps the transfer cancellation rules untouched", async () => {
      const h = createHarness();
      const order = makeOrder({ payment: { ...basePayment(), provider: null, status: PaymentStatus.PAID } as unknown as Payment });
      h.repository.findByIdentifierInTransaction.mockResolvedValue(order);
      h.repository.updateStateIfCurrent.mockResolvedValue(true);
      h.repository.findByIdInTransaction.mockResolvedValue(order);
      await expect(cancel(h.service, false)).resolves.toMatchObject({ id: "sale-1" });
    });
  });
});

describe("provider payment admin DTOs", () => {
  it("exposes safe attempt, refund, risk and reconciliation data without secrets", () => {
    const order = mpOrder({}, {
      attempts: [
        { ...attempt(PaymentAttemptStatus.REJECTED), attemptNumber: 1, rawOrderStatus: "failed", rawOrderStatusDetail: "failed_by_error_in_card_data" },
        { ...attempt(PaymentAttemptStatus.PARTIALLY_REFUNDED), attemptNumber: 2, providerOrderId: "ORD1", providerReferenceIds: { paymentReferenceId: "REF1" }, providerTransactionId: "PAY1", providerUpdatedAt: new Date("2026-10-21T10:00:00Z"), rawOrderStatus: "processed", rawOrderStatusDetail: "partially_refunded", refundedAmount: 25 },
      ],
      attentionReason: "review_over_1h", attentionRequiredAt: new Date("2026-10-21T11:00:00Z"), fulfillmentHoldReasons: ["dispute"], refundedAmount: 25, status: PaymentStatus.PARTIALLY_REFUNDED,
    });

    const detail = toAdminSaleDetailDto(order);
    expect(detail.payment?.providerPayment).toMatchObject({
      attemptCount: 2, dispute: true, fraudAlert: false, fullRefund: false, lastVerifiedAt: "2026-10-21T10:00:00.000Z", provider: "MERCADOPAGO",
      rawStatus: "processed", rawStatusDetail: "partially_refunded", refundedAmount: 25, unresolvedReconciliation: false,
    });
    expect(detail.payment?.providerPayment?.attempts[1]).toMatchObject({ attemptNumber: 2, providerOrderId: "ORD1", providerReferenceId: "REF1", providerTransactionId: "PAY1" });
    expect(toAdminSaleSummaryDto(order)).toMatchObject({ paymentAttention: true, paymentDispute: true, paymentProvider: "MERCADOPAGO", paymentRefundedAmount: 25 });
    expect(JSON.stringify(detail)).not.toMatch(/idempotency|clientKey|requestHash|token|secret|signature/i);
  });

  it("flags unresolved reconciliation for UNKNOWN pending attempts and omits provider data for transfers", () => {
    const unknown = toAdminSaleDetailDto(mpOrder({}, { attempts: [attempt(PaymentAttemptStatus.UNKNOWN)], status: PaymentStatus.PENDING }));
    expect(unknown.payment?.providerPayment?.unresolvedReconciliation).toBe(true);

    const transfer = makeOrder({ payment: { ...basePayment(), provider: null, status: PaymentStatus.PENDING } as unknown as Payment });
    const dto = toAdminSaleDetailDto(transfer);
    expect(dto.payment).not.toHaveProperty("providerPayment");
    expect(dto).not.toHaveProperty("paymentProvider");
  });
});

function attempt(status: PaymentAttemptStatus) {
  return { attemptNumber: 1, challengeCreatedAt: null, outcomeAt: null, providerOrderId: null, providerReferenceIds: null, providerTransactionId: null, providerUpdatedAt: null, rawOrderStatus: null, rawOrderStatusDetail: null, rawTransactionStatus: null, rawTransactionStatusDetail: null, refundedAmount: 0, status, submittedAt: new Date("2026-10-21T09:00:00Z"), clientKey: "secret-client-key", requestHash: "hash", providerIdempotencyKey: "idem" };
}

function basePayment() {
  return { amount: 100, attempts: [], attentionReason: null, attentionRequiredAt: null, bankTransferSnapshot: null, currency: "ARS", fulfillmentHoldReasons: [], id: "payment-1", orderId: "sale-1", paymentMethodId: "mp-card", paymentMethodSnapshot: {}, paymentOptionId: null, provider: PaymentProvider.MERCADOPAGO, refundedAmount: 0, retryUntil: null, reviewStartedAt: null, status: PaymentStatus.PAID };
}

function mpOrder(order: Partial<SalesOrderRecord> = {}, payment: Record<string, unknown> = {}): SalesOrderRecord {
  return makeOrder({ status: OrderStatus.CONFIRMED, ...order, payment: { ...basePayment(), ...payment } as unknown as Payment });
}

function makeOrder(overrides: Partial<SalesOrderRecord> = {}): SalesOrderRecord {
  return { id: "sale-1", number: "EN-SALE-1", inventoryEffectId: null, inventoryPolicy: OrderInventoryPolicy.NOT_APPLICABLE, status: OrderStatus.CONFIRMED, shippingStatus: OrderShippingStatus.TO_PACK, deliveryType: OrderDeliveryType.SHIPPING, isArchived: false, currency: "ARS", customerEmail: "customer@example.com", customerFirstName: "Test", customerLastName: "Customer", customerSnapshot: {}, deliverySnapshot: {}, discountSnapshot: {}, subtotal: 0, discountAmount: 0, shippingCost: 0, total: 0, createdAt: new Date("2026-10-21T00:00:00.000Z"), updatedAt: new Date("2026-10-21T00:00:00.000Z"), items: [], history: [], payment: null, ...overrides } as unknown as SalesOrderRecord;
}

function createHarness() {
  const repository = { appendHistory: jest.fn(), assignInventoryOwnership: jest.fn(), confirmPaymentIfCurrent: jest.fn(), createManualSale: jest.fn(), findByIdentifierInTransaction: jest.fn(), findByIdInTransaction: jest.fn(), findBySourceOrderIdInTransaction: jest.fn().mockResolvedValue(null), list: jest.fn(), lockOrderAndPayment: jest.fn(), markOrderConverted: jest.fn(), transferInventoryOwnership: jest.fn(), updateState: jest.fn(), updateStateIfCurrent: jest.fn(), transaction: jest.fn((callback: (transaction: TransactionClient) => Promise<unknown>) => callback({} as TransactionClient)) };
  const inventoryRepository = { deductStockForItems: jest.fn(), restoreStockForItems: jest.fn(), restoreUncompensatedDeductions: jest.fn() };
  return { inventoryRepository, repository, service: new SalesService(repository as unknown as SalesRepository, inventoryRepository as unknown as InventoryRepository) };
}
