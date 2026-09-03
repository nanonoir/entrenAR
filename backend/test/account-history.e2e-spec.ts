import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
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
  expectCheckoutError as expectError,
  expectCheckoutJson as expectJson,
  loginCheckoutUser as login,
  requireCheckoutFixtures as requireFixtures,
  seedCheckoutHistoryOrder,
  testCheckoutConfig,
} from "./support/checkout-http.helpers";
import {
  HTTP_METHOD,
  type AccountOrderResponse,
  type CheckoutFixtures,
  type RequestOptions,
  type SessionFixture,
} from "./support/checkout-http.types";

const databaseUrl = process.env["DATABASE_URL"];

describe("account order history REST API (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let fixtures: CheckoutFixtures | undefined;
  let ownerSession: SessionFixture;
  let foreignSession: SessionFixture;
  let adminSession: SessionFixture;
  let paymentSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for account history e2e tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
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
    foreignSession = await login(baseUrl, fixture.foreign);
    adminSession = await login(baseUrl, fixture.admin);
    await seedCheckoutHistoryOrder(baseUrl, fixture, ownerSession);
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

  it("returns only the authenticated customer's immutable order history", async () => {
    const fixture = requireFixtures(fixtures);
    const ownerHistory = await request("/account/orders", { method: HTTP_METHOD.GET, token: ownerSession.accessToken });
    const foreignHistory = await request("/account/orders", { method: HTTP_METHOD.GET, token: foreignSession.accessToken });
    const adminHistory = await request("/account/orders", { method: HTTP_METHOD.GET, token: adminSession.accessToken });
    const anonymousHistory = await request("/account/orders", { method: HTTP_METHOD.GET });

    expect(ownerHistory.status).toBe(200);
    const orders = await json<AccountOrderResponse[]>(ownerHistory);
    expect(orders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.any(String), status: "preparacion", trackingCode: expect.any(String), total: 150 }),
    ]));
    expect(orders[0]?.items[0]).toEqual(expect.objectContaining({ name: "Customer fixture product", price: 50, quantity: 1 }));
    expect(orders[0]).not.toHaveProperty("userId");
    expect(fixture.owner.id).not.toBe(fixture.foreign.id);
    await expectJson(foreignHistory, []);
    await expectError(adminHistory, 403, "FORBIDDEN");
    await expectError(anonymousHistory, 401, "UNAUTHORIZED");
  });

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    return checkoutRequest(baseUrl, path, options);
  }
});
