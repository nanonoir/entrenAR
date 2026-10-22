import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { PaymentMethodStatus } from "../src/generated/prisma/enums";
import {
  canceledOrder,
  processedAccreditedOrder,
} from "../src/modules/payments/mercadopago/__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrdersPort,
} from "../src/modules/payments/mercadopago/mercadopago-orders.port";
import { PaymentReducerService } from "../src/modules/payments/payment-reducer.service";
import {
  configureCheckoutCommerce,
  createCheckoutFixtures,
  deleteCheckoutFixtures,
  restorePaymentMethod,
  restoreShippingProvider,
  type PaymentMethodSnapshot,
  type ShippingProviderSnapshot,
} from "./support/checkout-database-fixtures";
import {
  checkoutJson as json,
  checkoutRequest,
  loginCheckoutUser as login,
  requireCheckoutFixtures as requireFixtures,
  testCheckoutConfig,
} from "./support/checkout-http.helpers";
import type { CheckoutFixtures, SessionFixture } from "./support/checkout-http.types";
import { buildCardBody, orderIdOf, providerOrder } from "./support/payments-card.helpers";
import { settleCheckoutPaymentFixtures } from "./support/payments-settle.helpers";

process.env["MERCADOPAGO_ACCESS_TOKEN"] = "TEST-integration-access-token";
process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "integration-webhook-secret";
process.env["MERCADOPAGO_ENVIRONMENT"] = "test";

const databaseUrl = process.env["DATABASE_URL"];

describe("Mercado Pago card payments (PostgreSQL integration, mocked provider port)", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let reducer: PaymentReducerService;
  let fixtures: CheckoutFixtures | undefined;
  let baseUrl = "";
  let ownerSession: SessionFixture;
  let raceFirstSession: SessionFixture;
  let raceSecondSession: SessionFixture;
  let mpSnapshot: PaymentMethodSnapshot | undefined;
  let bankSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;
  let openTransactions = 0;
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payment integration tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MERCADOPAGO_ORDERS_PORT)
      .useValue(port as unknown as MercadoPagoOrdersPort)
      .compile();
    prisma = moduleFixture.get(PrismaService);
    reducer = moduleFixture.get(PaymentReducerService);
    mpSnapshot = await prisma.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } });
    bankSnapshot = await prisma.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
    shippingSnapshot = await prisma.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
    await configureCheckoutCommerce(prisma);
    await prisma.paymentMethodConfig.update({
      data: { selectedOptionId: "mp-instant", status: PaymentMethodStatus.ACTIVE },
      where: { id: "mercado-pago" },
    });
    fixtures = await createCheckoutFixtures(prisma);

    const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
    jest.spyOn(prisma, "$transaction").mockImplementation(((...args: unknown[]) => {
      openTransactions += 1;
      return original(...args).finally(() => {
        openTransactions -= 1;
      });
    }) as never);

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, { ...testCheckoutConfig(), mercadoPago: { accessToken: "x", environment: "test", webhookSecret: "y" } });
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();

    const fixture = requireFixtures(fixtures);
    ownerSession = await login(baseUrl, fixture.owner);
    raceFirstSession = await login(baseUrl, fixture.raceFirst);
    raceSecondSession = await login(baseUrl, fixture.raceSecond);
  });

  beforeEach(() => {
    port.createOrder.mockReset();
    port.getOrder.mockReset();
  });

  afterAll(async () => {
    try {
      jest.restoreAllMocks();
      if (fixtures) {
        await settleCheckoutPaymentFixtures(prisma, fixtures);
        const guestOrders = await prisma.order.findMany({ select: { id: true }, where: { customerEmail: fixtures.guestOwner.email } });
        const ids = guestOrders.map((order) => order.id);
        await prisma.checkoutIdempotencyKey.deleteMany({ where: { orderId: { in: ids } } });
        await prisma.order.deleteMany({ where: { id: { in: ids } } });
        await deleteCheckoutFixtures(prisma, fixtures);
      }
      if (mpSnapshot) await restorePaymentMethod(prisma, mpSnapshot);
      if (bankSnapshot) await restorePaymentMethod(prisma, bankSnapshot);
      if (shippingSnapshot) await restoreShippingProvider(prisma, shippingSnapshot);
    } finally {
      if (app) await app.close();
    }
  });

  it("never holds a database transaction open while calling the provider", async () => {
    const fixture = requireFixtures(fixtures);
    const observed: number[] = [];
    port.createOrder.mockImplementation((input: { externalReference: string }) => {
      observed.push(openTransactions);
      return Promise.resolve(providerOrder(processedAccreditedOrder, input.externalReference));
    });
    port.getOrder.mockImplementation((id: string) => {
      observed.push(openTransactions);
      return Promise.resolve(providerOrder(processedAccreditedOrder, orderIdOf(id)));
    });
    const body = await buildCardBody(baseUrl, fixture.customerProduct, fixture.customerCart.sessionToken, ownerSession, "integration-key-0001");
    const transactionsBefore = jest.mocked(prisma.$transaction).mock.calls.length;

    const response = await checkoutRequest(baseUrl, "/checkout/payments/mercadopago", { body, token: ownerSession.accessToken });

    expect(response.status).toBe(201);
    expect(jest.mocked(prisma.$transaction).mock.calls.length - transactionsBefore).toBeGreaterThanOrEqual(2);
    expect(observed.length).toBeGreaterThanOrEqual(2);
    expect(observed.every((depth) => depth === 0)).toBe(true);
  });

  it("places atomically: the losing last-unit checkout leaves no order, payment, attempt or stock change", async () => {
    const fixture = requireFixtures(fixtures);
    port.createOrder.mockImplementation((input: { externalReference: string }) =>
      Promise.resolve(providerOrder(processedAccreditedOrder, input.externalReference)));
    port.getOrder.mockImplementation((id: string) => Promise.resolve(providerOrder(processedAccreditedOrder, orderIdOf(id))));
    const [firstBody, secondBody] = await Promise.all([
      buildCardBody(baseUrl, fixture.raceProduct, fixture.raceFirstCart.sessionToken, raceFirstSession, "atomic-key-first-1"),
      buildCardBody(baseUrl, fixture.raceProduct, fixture.raceSecondCart.sessionToken, raceSecondSession, "atomic-key-second-1"),
    ]);

    const responses = await Promise.all([
      checkoutRequest(baseUrl, "/checkout/payments/mercadopago", { body: firstBody, token: raceFirstSession.accessToken }),
      checkoutRequest(baseUrl, "/checkout/payments/mercadopago", { body: secondBody, token: raceSecondSession.accessToken }),
    ]);

    const statuses = responses.map((response) => response.status);
    expect(statuses.sort()).toEqual([201, 409]);
    const loserIndex = responses[0]?.status === 409 ? 0 : 1;
    const loser = loserIndex === 0 ? fixture.raceFirst : fixture.raceSecond;
    const loserCart = loserIndex === 0 ? fixture.raceFirstCart : fixture.raceSecondCart;
    const [orders, attempts, payments, variant, cart, session, keys] = await Promise.all([
      prisma.order.count({ where: { userId: loser.id } }),
      prisma.paymentAttempt.count({ where: { payment: { order: { userId: loser.id } } } }),
      prisma.orderPayment.count({ where: { order: { userId: loser.id } } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: fixture.raceProduct.variantId } }),
      prisma.cart.findUniqueOrThrow({ include: { items: true }, where: { id: loserCart.cartId } }),
      prisma.checkoutSession.findFirstOrThrow({ where: { cartId: loserCart.cartId } }),
      prisma.checkoutIdempotencyKey.count({ where: { order: { userId: loser.id } } }),
    ]);
    expect({ attempts, keys, orders, payments }).toEqual({ attempts: 0, keys: 0, orders: 0, payments: 0 });
    expect(variant.quantity).toBe(0);
    expect(cart.items).toHaveLength(1);
    expect(session.status).toBe("ACTIVE");
    expect(port.createOrder).toHaveBeenCalledTimes(1);
  });

  it("returns stock exactly once when concurrent cancellation observations arrive for an unresolved payment", async () => {
    const fixture = requireFixtures(fixtures);
    port.createOrder.mockRejectedValue(new MercadoPagoOrdersError("timeout", {
      category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT,
      outcomeUncertain: true,
    }));
    const body = await buildCardBody(baseUrl, fixture.guestProduct, fixture.guestCart.sessionToken, undefined, "compensation-key-1", fixture.guestOwner.email);

    const response = await checkoutRequest(baseUrl, "/checkout/payments/mercadopago", { body });
    expect(response.status).toBe(202);
    const view = await json<{ orderId: string; attempt: { id: string } }>(response);
    const variantBefore = await prisma.productVariant.findUniqueOrThrow({ where: { id: fixture.guestProduct.variantId } });
    expect(variantBefore.quantity).toBe(2);

    const observation = providerOrder(canceledOrder, view.orderId);
    const results = await Promise.allSettled([
      reducer.applyObservation(view.attempt.id, observation),
      reducer.applyObservation(view.attempt.id, observation),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);

    const [order, variant, restoreRows] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: view.orderId } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: fixture.guestProduct.variantId } }),
      prisma.inventoryHistory.findMany({ where: { referenceId: view.orderId, delta: { gt: 0 } } }),
    ]);
    expect(order.status).toBe("CANCELLED");
    expect(variant.quantity).toBe(3);
    expect(restoreRows).toHaveLength(1);

    await reducer.applyObservation(view.attempt.id, observation);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: fixture.guestProduct.variantId } })).quantity).toBe(3);
  });
});
