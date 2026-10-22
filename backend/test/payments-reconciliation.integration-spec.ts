import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import {
  CatalogVisibility,
  InventoryOperation,
  OrderDeliveryType,
  OrderInventoryPolicy,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  StockMode,
} from "../src/generated/prisma/enums";
import {
  failedOrder,
  processedAccreditedOrder,
} from "../src/modules/payments/mercadopago/__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrdersPort,
} from "../src/modules/payments/mercadopago/mercadopago-orders.port";
import { PaymentAttentionService } from "../src/modules/payments/payment-attention.service";
import { PaymentReconciliationService } from "../src/modules/payments/payment-reconciliation.service";
import { PaymentReducerService } from "../src/modules/payments/payment-reducer.service";
import { lockOrderAndPayment } from "../src/modules/payments/payments-transaction";
import { providerOrder } from "./support/payments-card.helpers";
import { settlePaymentFixtures } from "./support/payments-settle.helpers";

process.env["MERCADOPAGO_ACCESS_TOKEN"] = "TEST-integration-access-token";
process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "integration-webhook-secret";
process.env["MERCADOPAGO_ENVIRONMENT"] = "test";

const databaseUrl = process.env["DATABASE_URL"];
const MINUTE = 60_000;
const STOCK_BEFORE_SALE = 10;
const SOLD = 2;

interface ScenarioOptions {
  attemptStatus: PaymentAttemptStatus;
  nextReconcileAt?: Date;
  providerOrderId?: string;
  retryUntil?: Date | null;
}

describe("Mercado Pago expiry and reconciliation (PostgreSQL integration, mocked provider port)", () => {
  const suffix = randomUUID().slice(0, 8);
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };
  const orderIds: string[] = [];
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let reducer: PaymentReducerService;
  let reconciliation: PaymentReconciliationService;
  let attention: PaymentAttentionService;
  let productId: string;
  let sequence = 0;
  const variantIds: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payment integration tests.");

    moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MERCADOPAGO_ORDERS_PORT)
      .useValue(port as unknown as MercadoPagoOrdersPort)
      .compile();
    await moduleFixture.init();
    prisma = moduleFixture.get(PrismaService);
    reducer = moduleFixture.get(PaymentReducerService);
    reconciliation = moduleFixture.get(PaymentReconciliationService);
    attention = moduleFixture.get(PaymentAttentionService);

    const product = await prisma.product.create({
      data: {
        name: `Reconcile ${suffix}`,
        price: 100,
        publicSlug: `reconcile-${suffix}`,
        slug: `reconcile-${suffix}`,
        visibility: CatalogVisibility.HIDDEN,
        variants: { create: { name: "Base", quantity: 0, sku: `REC-BASE-${suffix}`, stockMode: StockMode.TRACKED } },
      },
    });
    productId = product.id;
  });

  beforeEach(() => {
    port.getOrder.mockReset();
    port.searchOrders.mockReset();
  });

  afterAll(async () => {
    try {
      // Orders cascade to payments/attempts/history. The stock ledger is append-only and restricts its product and
      // variants, so those rows stay (unique per run, `Reconcile <suffix>`); no other fixture shares them.
      if (prisma) {
        await settlePaymentFixtures(prisma, { id: { in: orderIds } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
    } finally {
      await moduleFixture?.close();
    }
  });

  /** One sold order: stock already deducted in the ledger, payment with one attempt in the requested state. */
  async function createScenario(options: ScenarioOptions) {
    sequence += 1;
    const label = `${suffix}-${sequence}`;
    const variant = await prisma.productVariant.create({
      data: { name: `Variant ${label}`, productId, quantity: STOCK_BEFORE_SALE - SOLD, sku: `REC-${label}`, stockMode: StockMode.TRACKED },
    });
    variantIds.push(variant.id);
    const inventoryEffectId = `effect-${label}`;
    const order = await prisma.order.create({
      data: {
        customerEmail: `buyer-${label}@example.test`,
        customerFirstName: "Pay",
        customerLastName: "Test",
        deliveryType: OrderDeliveryType.PICKUP,
        inventoryEffectId,
        inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED,
        items: {
          create: [{ lineSubtotal: 200, productId, productName: "Reconcile", quantity: SOLD, sku: `REC-${label}`, unitPrice: 100, variantId: variant.id }],
        },
        number: `REC-${label}`,
        status: OrderStatus.PENDING,
        subtotal: 200,
        total: 200,
      },
    });
    orderIds.push(order.id);
    await prisma.inventoryHistory.create({
      data: {
        delta: -SOLD,
        inventoryEffectId,
        operation: InventoryOperation.SUBTRACT,
        origin: "checkout",
        productId,
        resultingQuantity: STOCK_BEFORE_SALE - SOLD,
        stockMode: StockMode.TRACKED,
        variantId: variant.id,
      },
    });
    const attemptStatus = options.attemptStatus;
    const payment = await prisma.orderPayment.create({
      data: {
        amount: 200,
        attempts: {
          create: [{
            attemptNumber: 1,
            clientKey: `client-${label}`,
            expectedAmount: 200,
            nextReconcileAt: options.nextReconcileAt ?? null,
            providerIdempotencyKey: `idem-${label}`,
            providerOrderId: options.providerOrderId ?? null,
            requestHash: "hash",
            status: attemptStatus,
          }],
        },
        orderId: order.id,
        paymentMethodId: "mercado-pago",
        provider: PaymentProvider.MERCADOPAGO,
        retryUntil: options.retryUntil ?? null,
        status: PaymentStatus.PENDING,
      },
      include: { attempts: true },
    });

    return { attemptId: payment.attempts[0]!.id, orderId: order.id, variantId: variant.id };
  }

  const stockOf = async (variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).quantity;
  const restorationsOf = (variantId: string) => prisma.inventoryHistory.count({
    where: { compensatesMovementId: { not: null }, operation: InventoryOperation.ADD, variantId },
  });

  it("cancels an expired unpaid order and returns stock exactly once under concurrent expiry, webhook and sweep", async () => {
    const scenario = await createScenario({
      attemptStatus: PaymentAttemptStatus.REJECTED,
      providerOrderId: undefined,
      retryUntil: new Date(Date.now() - MINUTE),
    });
    const rejected = providerOrder(failedOrder, scenario.orderId);
    await prisma.paymentAttempt.update({ data: { providerOrderId: rejected.id }, where: { id: scenario.attemptId } });
    port.getOrder.mockResolvedValue(rejected);

    const results = await Promise.allSettled([
      reducer.expireUnpaid(scenario.orderId),
      reducer.expireUnpaid(scenario.orderId),
      reconciliation.expireDue(20),
      reconciliation.expireDue(20),
      reducer.applyObservation(scenario.attemptId, rejected),
      reducer.expireUnpaid(scenario.orderId),
    ]);

    expect(results.filter((result) => result.status === "rejected")).toEqual([]);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(scenario.variantId)).toBe(STOCK_BEFORE_SALE);
    expect(await restorationsOf(scenario.variantId)).toBe(1);
    const cancelledEvents = await prisma.orderHistory.count({ where: { orderId: scenario.orderId, title: "Order cancelled" } });
    expect(cancelledEvents).toBe(1);
    const restoration = await prisma.inventoryHistory.findFirstOrThrow({ where: { compensatesMovementId: { not: null }, variantId: scenario.variantId } });
    expect(restoration.origin).toBe("payment_expiry");
  });

  it("does not release when a customer retry was admitted first under the shared order lock", async () => {
    const scenario = await createScenario({ attemptStatus: PaymentAttemptStatus.REJECTED, retryUntil: new Date(Date.now() - MINUTE) });

    let expiry: Promise<boolean> | undefined;
    await prisma.$transaction(async (transaction) => {
      await lockOrderAndPayment(transaction, scenario.orderId);
      expiry = reducer.expireUnpaid(scenario.orderId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const payment = await transaction.orderPayment.findUniqueOrThrow({ where: { orderId: scenario.orderId } });
      await transaction.paymentAttempt.create({
        data: {
          attemptNumber: 2, clientKey: `retry-${randomUUID()}`, expectedAmount: 200, paymentId: payment.id,
          providerIdempotencyKey: randomUUID(), requestHash: "hash", status: PaymentAttemptStatus.SUBMITTING,
        },
      });
      await transaction.orderPayment.update({ data: { retryUntil: null }, where: { id: payment.id } });
    });

    expect(await expiry).toBe(false);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } });
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(await stockOf(scenario.variantId)).toBe(STOCK_BEFORE_SALE - SOLD);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("does not release before the database deadline", async () => {
    const scenario = await createScenario({ attemptStatus: PaymentAttemptStatus.REJECTED, retryUntil: new Date(Date.now() + 5 * MINUTE) });

    expect(await reducer.expireUnpaid(scenario.orderId)).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.PENDING);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("postpones the release when a known provider order cannot be re-read", async () => {
    const scenario = await createScenario({ attemptStatus: PaymentAttemptStatus.REJECTED, retryUntil: new Date(Date.now() - MINUTE) });
    const rejected = providerOrder(failedOrder, scenario.orderId);
    await prisma.paymentAttempt.update({ data: { providerOrderId: rejected.id }, where: { id: scenario.attemptId } });
    port.getOrder.mockRejectedValue(new MercadoPagoOrdersError("down", { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT }));

    await reconciliation.expireDue(50);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.PENDING);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("keeps an UNKNOWN attempt and its stock when the search finds nothing, even after 30 minutes", async () => {
    const scenario = await createScenario({ attemptStatus: PaymentAttemptStatus.UNKNOWN, nextReconcileAt: new Date(Date.now() - MINUTE) });
    await prisma.paymentAttempt.update({ data: { submittedAt: new Date(Date.now() - 31 * MINUTE) }, where: { id: scenario.attemptId } });
    port.searchOrders.mockResolvedValue([]);

    const outcomes = await reconciliation.reconcileDue("pending", 20);
    expect(outcomes).toContain("unresolved");
    await attention.sweep();

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ include: { payment: true }, where: { id: scenario.attemptId } });
    expect(attempt.status).toBe(PaymentAttemptStatus.UNKNOWN);
    expect(attempt.reconcileLeaseUntil).toBeNull();
    expect(attempt.payment.attentionReason).toBe("unresolved_unknown_outcome");
    expect(attempt.payment.attentionRequiredAt).not.toBeNull();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.PENDING);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("claims disjoint due attempts with SKIP LOCKED, takes over expired leases and refuses stale fences", async () => {
    const created = [];
    for (let index = 0; index < 4; index += 1) {
      created.push(await createScenario({ attemptStatus: PaymentAttemptStatus.PROCESSING, nextReconcileAt: new Date(Date.now() - (index + 1) * MINUTE) }));
    }
    const mine = new Set(created.map((scenario) => scenario.attemptId));

    const [first, second] = await Promise.all([reconciliation.claimDue("pending", 20), reconciliation.claimDue("pending", 20)]);
    const firstIds = first.map((claim) => claim.id).filter((id) => mine.has(id));
    const secondIds = second.map((claim) => claim.id).filter((id) => mine.has(id));
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(4);

    const owned = [...first, ...second].find((claim) => mine.has(claim.id))!;
    expect(await reconciliation.claimDue("pending", 20).then((rows) => rows.filter((claim) => mine.has(claim.id)))).toEqual([]);

    // Lease expiry (swept) lets another worker take over; the first worker's fence is then stale.
    await prisma.paymentAttempt.update({ data: { reconcileLeaseUntil: new Date(Date.now() - 1_000) }, where: { id: owned.id } });
    const swept = await attention.sweep();
    expect(swept.attemptLeasesReclaimed).toBeGreaterThanOrEqual(1);
    const takeover = (await reconciliation.claimDue("pending", 20)).find((claim) => claim.id === owned.id);
    expect(takeover).toBeDefined();
    expect(takeover!.reconcileFence).toBeGreaterThan(owned.reconcileFence);

    const accredited = providerOrder(processedAccreditedOrder, created.find((scenario) => scenario.attemptId === owned.id)!.orderId);
    const stale = await reducer.applyObservation(owned.id, accredited, owned.reconcileFence);
    expect(stale.stale).toBe(true);
    const unchanged = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: owned.id } });
    expect(unchanged.status).toBe(PaymentAttemptStatus.PROCESSING);

    // The current fence commits.
    await prisma.paymentAttempt.update({ data: { providerOrderId: accredited.id }, where: { id: owned.id } });
    const applied = await reducer.applyObservation(owned.id, accredited, takeover!.reconcileFence);
    expect(applied.stale).toBeUndefined();
    expect(applied.attemptStatus).toBe(PaymentAttemptStatus.APPROVED);
  });
});
