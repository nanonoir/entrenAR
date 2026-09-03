import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
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
  CheckoutFixtures,
  CheckoutQuoteResponse,
  ProductFixture,
  RequestOptions,
  SessionFixture,
} from "./support/checkout-http.types";

const databaseUrl = process.env["DATABASE_URL"];

describe("checkout quote REST API (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let fixtures: CheckoutFixtures | undefined;
  let foreignSession: SessionFixture;
  let adminSession: SessionFixture;
  let staleSession: SessionFixture;
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
    foreignSession = await login(baseUrl, fixture.foreign);
    adminSession = await login(baseUrl, fixture.admin);
    staleSession = await login(baseUrl, fixture.staleOwner);
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

  it("rejects foreign customer, guest-session, and ADMIN ownership without changing state", async () => {
    const fixture = requireFixtures(fixtures);
    const before = await readState(prismaOrThrow(), fixture.customerCart, fixture.customerProduct, fixture.owner.id);
    const foreign = await request("/checkout/quote", {
      body: quoteBody(fixture.customerProduct, fixture.customerCart.sessionToken),
      token: foreignSession.accessToken,
    });
    const admin = await request("/checkout/quote", {
      body: quoteBody(fixture.customerProduct, fixture.customerCart.sessionToken),
      token: adminSession.accessToken,
    });
    const invalidGuest = await request("/checkout/quote", {
      body: quoteBody(fixture.customerProduct, `invalid-session-token-${fixture.suffix}`),
    });

    await expectError(foreign, 401, "CHECKOUT_SESSION_INVALID");
    await expectError(admin, 403, "FORBIDDEN");
    await expectError(invalidGuest, 401, "CHECKOUT_SESSION_INVALID");
    await expect(readState(prismaOrThrow(), fixture.customerCart, fixture.customerProduct, fixture.owner.id)).resolves.toEqual(before);
  });

  it("returns VALIDATION_ERROR for forged totals, prices, stock, cart IDs, and user IDs", async () => {
    const fixture = requireFixtures(fixtures);
    const before = await readState(prismaOrThrow(), fixture.validationCart, fixture.validationProduct, fixture.validationOwner.id);
    const malformedQuote = await request("/checkout/quote", {
      body: { ...quoteBody(fixture.validationProduct, fixture.validationCart.sessionToken), total: 0 },
      token: validationSession.accessToken,
    });
    const response = await request("/checkout/complete", {
      body: {
        ...completeBody(fixture.validationProduct, fixture.validationCart.sessionToken, undefined, "forged-key", fixture.validationOwner.email),
        cartId: fixture.customerCart.cartId,
        items: [{ productId: fixture.validationProduct.productId, price: 0, quantity: 1, stock: 999, variantId: fixture.validationProduct.variantId }],
        total: 0,
        userId: fixture.foreign.id,
      },
      token: validationSession.accessToken,
    });

    await expectError(malformedQuote, 400, "VALIDATION_ERROR");
    await expectError(response, 400, "VALIDATION_ERROR");
    await expect(readState(prismaOrThrow(), fixture.validationCart, fixture.validationProduct, fixture.validationOwner.id)).resolves.toEqual(before);
  });

  it("rejects stale, hidden, and missing selections without creating orders", async () => {
    const fixture = requireFixtures(fixtures);
    const staleQuoteResponse = await request("/checkout/quote", {
      body: quoteBody(fixture.staleProduct, undefined, "andreani:envío-a-domicilio"),
      token: staleSession.accessToken,
    });
    const staleQuote = await json<CheckoutQuoteResponse>(staleQuoteResponse);
    const database = prismaOrThrow();
    await database.productVariant.update({ data: { price: "75.00" }, where: { id: fixture.staleProduct.variantId } });
    const staleComplete = await request("/checkout/complete", {
      body: completeBody(fixture.staleProduct, staleQuote.sessionToken, staleQuote.quoteId, "stale-key", fixture.staleOwner.email),
      method: "POST",
      token: staleSession.accessToken,
    });
    await expectError(staleComplete, 409, "PRICE_CHANGED");

    const before = await readState(database, fixture.validationCart, fixture.validationProduct, fixture.validationOwner.id);
    const hidden = await request("/checkout/quote", {
      body: quoteBody(fixture.hiddenProduct, undefined),
      token: validationSession.accessToken,
    });
    const missing = await request("/checkout/quote", {
      body: { items: [{ productId: `missing-${fixture.suffix}`, quantity: 1 }] },
      token: validationSession.accessToken,
    });
    const missingVariant = await request("/checkout/quote", {
      body: {
        items: [{ productId: fixture.validationProduct.productId, quantity: 1, variantId: `missing-variant-${fixture.suffix}` }],
        sessionToken: fixture.validationCart.sessionToken,
      },
      token: validationSession.accessToken,
    });
    await expectError(hidden, 404, "PRODUCT_NOT_FOUND");
    await expectError(missing, 404, "PRODUCT_NOT_FOUND");
    await expectError(missingVariant, 404, "VARIANT_NOT_FOUND");
    await expect(readState(database, fixture.validationCart, fixture.validationProduct, fixture.validationOwner.id)).resolves.toEqual(before);
  });

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    return checkoutRequest(baseUrl, path, options);
  }
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

function prismaOrThrow(): PrismaService {
  if (!prismaForHelpers) throw new Error("Checkout e2e Prisma service was not initialized.");
  return prismaForHelpers;
}

let prismaForHelpers: PrismaService | undefined;
