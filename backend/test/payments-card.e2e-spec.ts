import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { PaymentMethodStatus } from "../src/generated/prisma/enums";
import {
  failedOrder,
  processedAccreditedOrder,
} from "../src/modules/payments/mercadopago/__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type CreateMercadoPagoOrderRequest,
  type MercadoPagoOrdersPort,
} from "../src/modules/payments/mercadopago/mercadopago-orders.port";
import { toMercadoPagoOrder } from "../src/modules/payments/mercadopago/mercadopago-orders.schemas";
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
  checkoutQuoteBody as quoteBody,
  checkoutRequest,
  expectCheckoutError as expectError,
  loginAdminUser,
  loginCheckoutUser as login,
  requireCheckoutFixtures as requireFixtures,
  testCheckoutConfig,
} from "./support/checkout-http.helpers";
import type {
  CheckoutFixtures,
  CheckoutQuoteResponse,
  ProductFixture,
  RequestOptions,
  SessionFixture,
} from "./support/checkout-http.types";

import { settleCheckoutPaymentFixtures } from "./support/payments-settle.helpers";
import {
  CARD_ORDER_TOTAL,
  CARD_SHIPPING_METHOD,
  TEST_CARD,
  buildCardBody,
  orderIdOf,
  providerOrder,
} from "./support/payments-card.helpers";

process.env["MERCADOPAGO_ACCESS_TOKEN"] = "TEST-e2e-access-token";
process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "e2e-webhook-secret";
process.env["MERCADOPAGO_ENVIRONMENT"] = "test";

const databaseUrl = process.env["DATABASE_URL"];

interface PortMock {
  createOrder: jest.Mock<Promise<ReturnType<typeof toMercadoPagoOrder>>, [CreateMercadoPagoOrderRequest, string]>;
  getOrder: jest.Mock;
  searchOrders: jest.Mock;
}

describe("Mercado Pago card payment endpoints (e2e, mocked provider port)", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let fixtures: CheckoutFixtures | undefined;
  let sessions: Record<string, SessionFixture> = {};
  let adminSession: SessionFixture;
  let mpSnapshot: PaymentMethodSnapshot | undefined;
  let bankSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;
  const port: PortMock = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payment e2e tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MERCADOPAGO_ORDERS_PORT)
      .useValue(port as unknown as MercadoPagoOrdersPort)
      .compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    prismaForHelpers = database;
    mpSnapshot = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } });
    bankSnapshot = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
    shippingSnapshot = await database.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
    await configureCheckoutCommerce(database);
    await database.paymentMethodConfig.update({
      data: { selectedOptionId: "mp-instant", status: PaymentMethodStatus.ACTIVE },
      where: { id: "mercado-pago" },
    });
    fixtures = await createCheckoutFixtures(database);

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, { ...testCheckoutConfig(), mercadoPago: { accessToken: "x", environment: "test", webhookSecret: "y" } });
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();

    const fixture = requireFixtures(fixtures);
    sessions = {
      owner: await login(baseUrl, fixture.owner),
      raceFirst: await login(baseUrl, fixture.raceFirst),
      raceSecond: await login(baseUrl, fixture.raceSecond),
      replay: await login(baseUrl, fixture.replayOwner),
    };
    adminSession = await loginAdminUser(baseUrl, fixture.admin);
  });

  beforeEach(() => {
    port.createOrder.mockReset();
    port.getOrder.mockReset();
  });

  afterAll(async () => {
    try {
      if (prisma && fixtures) {
        await settleCheckoutPaymentFixtures(prisma, fixtures);
        const guestOrders = await prisma.order.findMany({ select: { id: true }, where: { customerEmail: fixtures.guestOwner.email } });
        const ids = guestOrders.map((order) => order.id);
        await prisma.checkoutIdempotencyKey.deleteMany({ where: { orderId: { in: ids } } });
        await prisma.order.deleteMany({ where: { id: { in: ids } } });
        await deleteCheckoutFixtures(prisma, fixtures);
      }
      if (prisma && mpSnapshot) await restorePaymentMethod(prisma, mpSnapshot);
      if (prisma && bankSnapshot) await restorePaymentMethod(prisma, bankSnapshot);
      if (prisma && shippingSnapshot) await restoreShippingProvider(prisma, shippingSnapshot);
    } finally {
      if (app) await app.close();
    }
  });

  it("rejects malformed, extra and unsupported card input before any placement", async () => {
    const fixture = requireFixtures(fixtures);
    const base = await cardBody(fixture.raceProduct, fixture.raceSecondCart.sessionToken, sessions["raceSecond"], "validation-key-0001");

    for (const mutated of [
      { ...base, unexpected: true },
      { ...base, card: { ...TEST_CARD, token: "short" } },
      { ...base, card: { ...TEST_CARD, paymentMethodId: "not-a-card" } },
      { ...base, card: { ...TEST_CARD, installments: 0 } },
      { ...base, card: { ...TEST_CARD, rawNumber: "4111111111111111" } },
      { ...base, quoteId: undefined },
    ]) {
      const response = await request("/checkout/payments/mercadopago", { body: mutated, token: sessions["raceSecond"]?.accessToken });
      await expectError(response, 400, "VALIDATION_ERROR");
    }
    expect(port.createOrder).not.toHaveBeenCalled();
    expect(await requireDb().order.count({ where: { userId: fixture.raceSecond.id } })).toBe(0);
  });

  it("requires credentials for reads and forbids admin actors", async () => {
    const fixture = requireFixtures(fixtures);
    await expectError(await request("/payments/orders/some-order", { method: "GET" }), 401, "CHECKOUT_SESSION_INVALID");
    await expectError(await request("/checkout/payments/active", { method: "GET" }), 401, "CHECKOUT_SESSION_INVALID");
    const body = await cardBody(fixture.raceProduct, fixture.raceSecondCart.sessionToken, sessions["raceSecond"], "validation-key-0002");
    await expectError(await request("/checkout/payments/mercadopago", { body, token: adminSession.accessToken }), 403, "FORBIDDEN");
    expect(port.createOrder).not.toHaveBeenCalled();
  });

  it("pays with an approved card, verifies it with the provider, finalizes checkout and replays without dispatching again", async () => {
    const fixture = requireFixtures(fixtures);
    const database = requireDb();
    const body = await cardBody(fixture.customerProduct, fixture.customerCart.sessionToken, sessions["owner"], "approved-key-0001");
    port.createOrder.mockImplementation((input) => Promise.resolve(providerOrder(processedAccreditedOrder, input.externalReference)));
    port.getOrder.mockImplementation((id: string) => Promise.resolve(providerOrder(processedAccreditedOrder, orderIdOf(id))));

    const response = await request("/checkout/payments/mercadopago", { body, token: sessions["owner"]?.accessToken });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const view = await json<PaymentView>(response);
    expect(view).toEqual(expect.objectContaining({ amount: 200, ok: true, orderStatus: "confirmed", paymentStatus: "paid", status: "paid" }));
    expect(JSON.stringify(view)).not.toContain(TEST_CARD.token);

    const sent = port.createOrder.mock.calls[0];
    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect(sent?.[0]).toEqual(expect.objectContaining({ externalReference: view.orderId, totalAmount: CARD_ORDER_TOTAL }));
    expect(sent?.[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent?.[1]).not.toContain("approved-key");

    const [order, cart, session, variant, attempt] = await Promise.all([
      database.order.findUniqueOrThrow({ include: { payment: true }, where: { id: view.orderId } }),
      database.cart.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.customerCart.cartId } }),
      database.checkoutSession.findFirstOrThrow({ where: { cartId: fixture.customerCart.cartId } }),
      database.productVariant.findUniqueOrThrow({ where: { id: fixture.customerProduct.variantId } }),
      database.paymentAttempt.findFirstOrThrow({ where: { payment: { orderId: view.orderId } } }),
    ]);
    expect(order.status).toBe("CONFIRMED");
    expect(order.payment).toEqual(expect.objectContaining({ provider: "MERCADOPAGO", status: "PAID" }));
    expect(cart.status).toBe("COMPLETED");
    expect(cart.items).toEqual([]);
    expect(session.status).toBe("COMPLETED");
    expect(variant.quantity).toBe(1);
    expect(JSON.stringify(attempt)).not.toContain(TEST_CARD.token);

    const replay = await request("/checkout/payments/mercadopago", { body, token: sessions["owner"]?.accessToken });
    expect(replay.status).toBe(201);
    expect((await json<PaymentView>(replay)).orderId).toBe(view.orderId);
    expect(port.createOrder).toHaveBeenCalledTimes(1);

    const conflicting = await request("/checkout/payments/mercadopago", {
      body: { ...body, card: { ...TEST_CARD, token: "tok_other_123456789" } },
      token: sessions["owner"]?.accessToken,
    });
    await expectError(conflicting, 409, "IDEMPOTENCY_KEY_REUSED");
    expect(await database.order.count({ where: { userId: fixture.owner.id } })).toBe(1);

    const status = await request(`/payments/orders/${view.orderId}`, { method: "GET", token: sessions["owner"]?.accessToken });
    expect(status.status).toBe(200);
    expect(status.headers.get("cache-control")).toBe("no-store");
    await expectError(
      await request(`/payments/orders/${view.orderId}`, { method: "GET", token: sessions["raceSecond"]?.accessToken }),
      404,
      "NOT_FOUND",
    );
    await expectError(
      await request(`/payments/orders/${view.orderId}/attempts`, {
        body: { card: { ...TEST_CARD, token: "tok_retry_123456789" }, idempotencyKey: "retry-key-paid-1" },
        token: sessions["owner"]?.accessToken,
      }),
      409,
      "PAYMENT_RETRY_UNAVAILABLE",
    );
  });

  it("opens a retry window after a rejection, holds stock and accepts one retry with a new key", async () => {
    const fixture = requireFixtures(fixtures);
    const database = requireDb();
    const body = await cardBody(fixture.replayProduct, fixture.replayCart.sessionToken, sessions["replay"], "rejected-key-0001");
    port.createOrder.mockImplementation((input) => Promise.resolve(providerOrder(failedOrder, input.externalReference)));
    port.getOrder.mockImplementation((id: string) => Promise.resolve(providerOrder(failedOrder, orderIdOf(id))));

    const response = await request("/checkout/payments/mercadopago", { body, token: sessions["replay"]?.accessToken });
    expect(response.status).toBe(201);
    const view = await json<PaymentView>(response);
    expect(view).toEqual(expect.objectContaining({ paymentStatus: "pending", status: "rejected" }));
    expect(view.retry.eligible).toBe(true);
    expect(view.retry.until).toEqual(expect.any(String));
    expect((await database.productVariant.findUniqueOrThrow({ where: { id: fixture.replayProduct.variantId } })).quantity).toBe(1);

    port.createOrder.mockImplementation((input) => Promise.resolve(providerOrder(processedAccreditedOrder, input.externalReference)));
    port.getOrder.mockImplementation((id: string) => Promise.resolve(providerOrder(processedAccreditedOrder, orderIdOf(id))));
    const retryBody = { card: { ...TEST_CARD, token: "tok_retry_123456789" }, idempotencyKey: "rejected-retry-0001" };
    const retry = await request(`/payments/orders/${view.orderId}/attempts`, { body: retryBody, token: sessions["replay"]?.accessToken });
    expect(retry.status).toBe(201);
    expect(await json<PaymentView>(retry)).toEqual(expect.objectContaining({ attempt: expect.objectContaining({ number: 2 }), status: "paid" }));
    expect(port.createOrder).toHaveBeenCalledTimes(2);

    const replayedRetry = await request(`/payments/orders/${view.orderId}/attempts`, { body: retryBody, token: sessions["replay"]?.accessToken });
    expect(replayedRetry.status).toBe(201);
    expect(port.createOrder).toHaveBeenCalledTimes(2);
    expect(await database.paymentAttempt.count({ where: { payment: { orderId: view.orderId } } })).toBe(2);
    expect((await database.productVariant.findUniqueOrThrow({ where: { id: fixture.replayProduct.variantId } })).quantity).toBe(1);
  });

  it("answers 202 and holds stock when the provider outcome is uncertain, exposing the guest order through the session", async () => {
    const fixture = requireFixtures(fixtures);
    const database = requireDb();
    const body = await cardBody(fixture.guestProduct, fixture.guestCart.sessionToken, undefined, "uncertain-key-0001", fixture.guestOwner.email);
    port.createOrder.mockRejectedValue(new MercadoPagoOrdersError("timeout", {
      category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT,
      outcomeUncertain: true,
    }));

    const response = await request("/checkout/payments/mercadopago", { body });
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const view = await json<PaymentView>(response);
    expect(view).toEqual(expect.objectContaining({ orderStatus: "pending", status: "unknown" }));
    expect(port.createOrder.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(new Set(port.createOrder.mock.calls.map((call) => call[1])).size).toBe(1);
    expect((await database.productVariant.findUniqueOrThrow({ where: { id: fixture.guestProduct.variantId } })).quantity).toBe(2);

    const active = await request("/checkout/payments/active", { headers: { "x-checkout-session": fixture.guestCart.sessionToken }, method: "GET" });
    expect(active.status).toBe(200);
    expect(active.headers.get("cache-control")).toBe("no-store");
    expect(await json<{ active: PaymentView | null }>(active)).toEqual(expect.objectContaining({ active: expect.objectContaining({ orderId: view.orderId }), ok: true }));
    await expectError(await request(`/payments/orders/${view.orderId}`, { method: "GET" }), 401, "CHECKOUT_SESSION_INVALID");
    const guestStatus = await request(`/payments/orders/${view.orderId}`, { headers: { "x-checkout-session": fixture.guestCart.sessionToken }, method: "GET" });
    expect(guestStatus.status).toBe(200);
  });

  it("sells the last unit once when two checkouts pay concurrently", async () => {
    const fixture = requireFixtures(fixtures);
    const database = requireDb();
    port.createOrder.mockImplementation((input) => Promise.resolve(providerOrder(processedAccreditedOrder, input.externalReference)));
    port.getOrder.mockImplementation((id: string) => Promise.resolve(providerOrder(processedAccreditedOrder, orderIdOf(id))));
    const [firstBody, secondBody] = await Promise.all([
      cardBody(fixture.raceProduct, fixture.raceFirstCart.sessionToken, sessions["raceFirst"], "race-key-first-1"),
      cardBody(fixture.raceProduct, fixture.raceSecondCart.sessionToken, sessions["raceSecond"], "race-key-second-1"),
    ]);

    const responses = await Promise.all([
      request("/checkout/payments/mercadopago", { body: firstBody, token: sessions["raceFirst"]?.accessToken }),
      request("/checkout/payments/mercadopago", { body: secondBody, token: sessions["raceSecond"]?.accessToken }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(port.createOrder).toHaveBeenCalledTimes(1);
    expect((await database.productVariant.findUniqueOrThrow({ where: { id: fixture.raceProduct.variantId } })).quantity).toBe(0);
    expect(await database.order.count({ where: { userId: { in: [fixture.raceFirst.id, fixture.raceSecond.id] } } })).toBe(1);
  });

});

interface PaymentView {
  amount: number;
  attempt: { id: string; number: number; status: string } | null;
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  retry: { eligible: boolean; until: string | null };
  status: string;
}

function request(path: string, options: RequestOptions = {}): Promise<Response> {
  return checkoutRequest(baseUrl, path, options);
}

function requireDb(): PrismaService {
  if (!prismaForHelpers) throw new Error("Prisma service was not initialized.");
  return prismaForHelpers;
}

let baseUrl = "";

function cardBody(
  product: ProductFixture,
  sessionToken: string,
  session: SessionFixture | undefined,
  idempotencyKey: string,
  email?: string,
): Promise<Record<string, unknown>> {
  return buildCardBody(baseUrl, product, sessionToken, session, idempotencyKey, email);
}

let prismaForHelpers: PrismaService | undefined;
