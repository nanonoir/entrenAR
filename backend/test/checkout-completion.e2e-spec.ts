import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { PaymentMethodStatus, ShippingProviderStatus } from "../src/generated/prisma/enums";
import {
  configureCheckoutCommerce,
  createCheckoutFixtures,
  deleteCheckoutFixtures,
  readCheckoutState as readState,
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
  loginCheckoutUser as login,
  requireCheckoutFixtures as requireFixtures,
  testCheckoutConfig,
} from "./support/checkout-http.helpers";
import type {
  CheckoutCompleteResponse,
  CheckoutFixtures,
  CheckoutQuoteResponse,
  ProductFixture,
  RequestOptions,
  SessionFixture,
} from "./support/checkout-http.types";

const databaseUrl = process.env["DATABASE_URL"];

describe("checkout completion REST API (e2e)", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let fixtures: CheckoutFixtures | undefined;
  let ownerSession: SessionFixture;
  let raceFirstSession: SessionFixture;
  let raceSecondSession: SessionFixture;
  let replaySession: SessionFixture;
  let validationSession: SessionFixture;
  let paymentSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for checkout e2e tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    prismaForHelpers = database;
    paymentSnapshot = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
    shippingSnapshot = await database.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
    await configureCheckoutCommerce(database);
    fixtures = await createCheckoutFixtures(database);

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, testCheckoutConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();

    const fixture = requireFixtures(fixtures);
    ownerSession = await login(baseUrl, fixture.owner);
    raceFirstSession = await login(baseUrl, fixture.raceFirst);
    raceSecondSession = await login(baseUrl, fixture.raceSecond);
    replaySession = await login(baseUrl, fixture.replayOwner);
    validationSession = await login(baseUrl, fixture.validationOwner);
  });

  afterAll(async () => {
    try {
      if (prisma && fixtures) await deleteCheckoutFixtures(prisma, fixtures);
      if (prisma && paymentSnapshot) await restorePaymentMethod(prisma, paymentSnapshot);
      if (prisma && shippingSnapshot) await restoreShippingProvider(prisma, shippingSnapshot);
    } finally {
      if (app) await app.close();
    }
  });

  it("supports a guest quote-to-complete flow and returns a request ID", async () => {
    const fixture = requireFixtures(fixtures);
    const quoteResponse = await request("/checkout/quote", {
      body: quoteBody(fixture.guestProduct, fixture.guestCart.sessionToken, "andreani:envío-a-domicilio"),
      headers: { "x-request-id": "checkout-e2e-guest-1" },
    });
    expect(quoteResponse.status).toBe(200);
    expect(quoteResponse.headers.get("x-request-id")).toBe("checkout-e2e-guest-1");
    const quote = await json<CheckoutQuoteResponse>(quoteResponse);
    expect(quote).toEqual(expect.objectContaining({ ok: true, shipping: 100, subtotal: 50, total: 150 }));
    expect(quote.sessionToken).toBe(fixture.guestCart.sessionToken);

    const completeResponse = await request("/checkout/complete", {
      body: completeBody(fixture.guestProduct, quote.sessionToken, quote.quoteId, "guest-complete-key", fixture.guestOwner.email),
      method: "POST",
    });
    expect(completeResponse.status).toBe(201);
    const completed = await json<CheckoutCompleteResponse>(completeResponse);
    expect(completed).toEqual(expect.objectContaining({ ok: true, orderId: expect.any(String), status: "pending", total: 150 }));

    const database = prismaOrThrow();
    const [order, cart, variant] = await Promise.all([
      database.order.findUniqueOrThrow({ include: { items: true, payment: true }, where: { id: completed.orderId } }),
      database.cart.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.guestCart.cartId } }),
      database.productVariant.findUniqueOrThrow({ where: { id: fixture.guestProduct.variantId } }),
    ]);
    expect(order.userId).toBeNull();
    expect(order.items[0]).toEqual(expect.objectContaining({ productId: fixture.guestProduct.productId, productName: "Guest fixture product" }));
    expect(order.payment).toEqual(expect.objectContaining({ paymentMethodId: "bank-transfer", status: "PENDING" }));
    expect(cart.status).toBe("COMPLETED");
    expect(cart.items).toEqual([]);
    expect(variant.quantity).toBe(2);
  });

  it("quotes and completes a customer order from current server values", async () => {
    const fixture = requireFixtures(fixtures);
    const quoteResponse = await request("/checkout/quote", {
      body: quoteBody(fixture.customerProduct, fixture.customerCart.sessionToken, "andreani:envío-a-domicilio"),
      headers: { "x-request-id": "checkout-e2e-customer-1" },
      token: ownerSession.accessToken,
    });
    expect(quoteResponse.status).toBe(200);
    expect(quoteResponse.headers.get("x-request-id")).toBe("checkout-e2e-customer-1");
    const quote = await json<CheckoutQuoteResponse>(quoteResponse);
    expect(quote).toEqual(expect.objectContaining({ discount: 0, ok: true, subtotal: 50, total: 150 }));

    const completeResponse = await request("/checkout/complete", {
      body: completeBody(fixture.customerProduct, fixture.customerCart.sessionToken, quote.quoteId, "customer-complete-key", fixture.owner.email),
      method: "POST",
      token: ownerSession.accessToken,
    });
    expect(completeResponse.status).toBe(201);
    const completed = await json<CheckoutCompleteResponse>(completeResponse);
    expect(completed).toEqual(expect.objectContaining({ ok: true, status: "pending", total: 150 }));

    const database = prismaOrThrow();
    const [order, variant, history, cart] = await Promise.all([
      database.order.findUniqueOrThrow({ include: { items: true, payment: true }, where: { id: completed.orderId } }),
      database.productVariant.findUniqueOrThrow({ where: { id: fixture.customerProduct.variantId } }),
      database.inventoryHistory.findMany({ where: { productId: fixture.customerProduct.productId, origin: "checkout" } }),
      database.cart.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.customerCart.cartId } }),
    ]);
    expect(order.userId).toBe(fixture.owner.id);
    expect(order.status).toBe("PENDING");
    expect(order.items[0]).toEqual(expect.objectContaining({ productName: "Customer fixture product", unitPrice: expect.any(Object) }));
    expect(order.payment).toEqual(expect.objectContaining({ paymentMethodId: "bank-transfer", status: "PENDING" }));
    expect(variant.quantity).toBe(1);
    expect(history).toEqual([expect.objectContaining({ delta: -1, origin: "checkout", variantId: fixture.customerProduct.variantId })]);
    expect(cart.status).toBe("COMPLETED");
    expect(cart.items).toEqual([]);
  });

  it("replays the same completion without duplicate order, stock, or inventory history", async () => {
    const fixture = requireFixtures(fixtures);
    const quoteResponse = await request("/checkout/quote", {
      body: quoteBody(fixture.replayProduct, fixture.replayCart.sessionToken, "andreani:envío-a-domicilio"),
      token: replaySession.accessToken,
    });
    const quote = await json<CheckoutQuoteResponse>(quoteResponse);
    const body = completeBody(fixture.replayProduct, fixture.replayCart.sessionToken, quote.quoteId, "replay-key", fixture.replayOwner.email);
    const first = await request("/checkout/complete", { body, method: "POST", token: replaySession.accessToken });
    const firstBody = await json<CheckoutCompleteResponse>(first);
    const beforeReplay = await readState(prismaOrThrow(), fixture.replayCart, fixture.replayProduct, fixture.replayOwner.id);
    const replay = await request("/checkout/complete", { body, method: "POST", token: replaySession.accessToken });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    await expect(json<CheckoutCompleteResponse>(replay)).resolves.toEqual(firstBody);
    await expect(readState(prismaOrThrow(), fixture.replayCart, fixture.replayProduct, fixture.replayOwner.id)).resolves.toEqual(beforeReplay);
  });

  it("allows one final-unit completion and rolls back the competing request", async () => {
    const fixture = requireFixtures(fixtures);
    const bodies = [
      completeBody(fixture.raceProduct, fixture.raceFirstCart.sessionToken, undefined, "race-first-key", fixture.raceFirst.email),
      completeBody(fixture.raceProduct, fixture.raceSecondCart.sessionToken, undefined, "race-second-key", fixture.raceSecond.email),
    ];
    const responses = await Promise.all([
      request("/checkout/complete", { body: bodies[0], method: "POST", token: raceFirstSession.accessToken }),
      request("/checkout/complete", { body: bodies[1], method: "POST", token: raceSecondSession.accessToken }),
    ]);
    const successful = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.status === 409);
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    await expectError(rejected[0]!, 409, "OUT_OF_STOCK");

    const database = prismaOrThrow();
    const [variant, orders, history, firstCart, secondCart] = await Promise.all([
      database.productVariant.findUniqueOrThrow({ where: { id: fixture.raceProduct.variantId } }),
      database.order.count({ where: { userId: { in: [fixture.raceFirst.id, fixture.raceSecond.id] } } }),
      database.inventoryHistory.count({ where: { productId: fixture.raceProduct.productId, origin: "checkout" } }),
      database.cart.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.raceFirstCart.cartId } }),
      database.cart.findUniqueOrThrow({ include: { items: true }, where: { id: fixture.raceSecondCart.cartId } }),
    ]);
    expect(variant.quantity).toBe(0);
    expect(orders).toBe(1);
    expect(history).toBe(1);
    expect([firstCart.items.length, secondCart.items.length].sort()).toEqual([0, 1]);
  });

  it("returns controlled payment and shipping conflicts without writes", async () => {
    const fixture = requireFixtures(fixtures);
    const database = prismaOrThrow();
    const body = completeBody(fixture.validationProduct, fixture.validationCart.sessionToken, undefined, "configuration-conflict-key", fixture.validationOwner.email);
    await database.paymentMethodConfig.update({ data: { status: PaymentMethodStatus.INACTIVE }, where: { id: "bank-transfer" } });
    const paymentResponse = await request("/checkout/complete", { body, method: "POST", token: validationSession.accessToken });
    await expectError(paymentResponse, 409, "PAYMENT_METHOD_UNAVAILABLE");
    await database.paymentMethodConfig.update({
      data: { bankConfig: {
        alias: "ENTRENAR.TEST",
        bankName: "Banco Test",
        cbuCvu: "0000000000000000000000",
        cuitCuil: "20-00000000-0",
        holderName: "EntrenAR Test",
      }, selectedOptionId: "direct-transfer", status: PaymentMethodStatus.ACTIVE },
      where: { id: "bank-transfer" },
    });
    await database.shippingProvider.update({ data: { status: ShippingProviderStatus.CONFIGURED_INACTIVE }, where: { id: "andreani" } });
    const shippingResponse = await request("/checkout/complete", { body, method: "POST", token: validationSession.accessToken });
    await expectError(shippingResponse, 409, "SHIPPING_OPTION_UNAVAILABLE");
    await configureCheckoutCommerce(database);
  });
});

function completeBody(
  product: ProductFixture,
  sessionToken: string | undefined,
  quoteId: string | undefined,
  idempotencyKey: string,
  email: string,
): object {
  return {
    address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
    customer: { email, firstName: "Checkout", lastName: "Customer" },
    idempotencyKey,
    items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
    paymentMethodId: "bank-transfer",
    paymentOptionId: "direct-transfer",
    ...(quoteId ? { quoteId } : {}),
    ...(sessionToken ? { sessionToken } : {}),
    shippingMethodId: "andreani:envío-a-domicilio",
  };
}

function request(path: string, options: RequestOptions = {}): Promise<Response> {
  return checkoutRequest(baseUrl, path, options);
}

function prismaOrThrow(): PrismaService {
  if (!prismaForHelpers) throw new Error("Checkout e2e Prisma service was not initialized.");
  return prismaForHelpers;
}

let baseUrl = "";
let prismaForHelpers: PrismaService | undefined;
