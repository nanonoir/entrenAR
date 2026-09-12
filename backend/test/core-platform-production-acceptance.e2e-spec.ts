import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import type { AppConfig } from "../src/config/app.config";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { Role } from "../src/generated/prisma/enums";
import { AuthService } from "../src/modules/auth/auth.service";
import { HealthService } from "../src/modules/health/health.service";
import {
  configureCheckoutCommerce,
  restorePaymentMethod,
  restoreShippingProvider,
  type PaymentMethodSnapshot,
  type ShippingProviderSnapshot,
} from "./support/checkout-database-fixtures";
import {
  createCheckoutDomainCart,
  createCheckoutDomainFixtureScope,
  createCheckoutDomainProduct,
  deleteCheckoutDomainFixtures,
  type CheckoutDomainFixtureScope,
  type DomainCartFixture,
  type DomainProductFixture,
} from "./support/checkout-domain-fixtures";

const ALLOWED_ORIGIN = "https://store.example.test";

describe("Core platform production acceptance (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let healthService: HealthService | undefined;
  let product: DomainProductFixture | undefined;
  let guestCart: DomainCartFixture | undefined;
  let paymentSnapshot: PaymentMethodSnapshot | undefined;
  let shippingSnapshot: ShippingProviderSnapshot | undefined;
  let fixtureScope: CheckoutDomainFixtureScope;
  let adminToken = "";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    healthService = moduleFixture.get(HealthService);
    fixtureScope = createCheckoutDomainFixtureScope();
    paymentSnapshot = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
    shippingSnapshot = await database.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
    await configureCheckoutCommerce(database);

    const suffix = randomUUID().replaceAll("-", "");
    const acceptanceProduct = await createCheckoutDomainProduct(database, "acceptance", suffix, 2, fixtureScope);
    product = acceptanceProduct;
    guestCart = await createCheckoutDomainCart(database, undefined, acceptanceProduct, 1, `acceptance-session-${suffix}`, suffix, fixtureScope);

    const adminId = `acceptance-admin-${suffix}`;
    fixtureScope.userIds.push(adminId);
    await database.user.create({
      data: {
        email: `${adminId}@example.test`,
        id: adminId,
        passwordHash: await bcrypt.hash(`Phase10-${suffix}-Admin!`, 4),
        role: Role.ADMIN,
      },
    });
    adminToken = (await moduleFixture.get(AuthService).loginAdmin(`${adminId}@example.test`, `Phase10-${suffix}-Admin!`)).accessToken;

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, testConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await deleteCheckoutDomainFixtures(prisma, fixtureScope);
        if (product) {
          await prisma.cartItem.deleteMany({ where: { productId: product.productId } });
        }
        if (paymentSnapshot) await restorePaymentMethod(prisma, paymentSnapshot);
        if (shippingSnapshot) await restoreShippingProvider(prisma, shippingSnapshot);
      }
    } finally {
      if (app) await app.close();
    }
  });

  it("serves aggregate and probe health aliases", async () => {
    const responses: Response[] = [];
    for (const path of ["/health", "/api/v1/health", "/api/v1/health/live", "/api/v1/health/ready"]) {
      responses.push(await request(path));
    }
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    const bodies = await Promise.all(responses.map((response) => json<Record<string, unknown>>(response)));
    expect(bodies[0]).toEqual(expect.objectContaining({ database: "up", ok: true, status: "ok" }));
    expect(bodies[1]).toEqual(expect.objectContaining({ database: "up", ok: true, status: "ok" }));
    expect(bodies[2]).toEqual({ ok: true, status: "live" });
    expect(bodies[3]).toEqual({ ok: true, status: "ready" });
  });

  it("allows credentialed CORS only for an allowlisted origin", async () => {
    const allowed = await request("/health", { headers: { origin: ALLOWED_ORIGIN } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");

    const unconfigured = await request("/health", { headers: { origin: "https://untrusted.example.test" } });
    expect(unconfigured.status).toBe(200);
    expect(unconfigured.headers.get("access-control-allow-origin")).toBeNull();
    expect(unconfigured.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("sanitizes unexpected 500 responses", async () => {
    const service = healthServiceOrThrow();
    const internalMessage = "acceptance-internal-database-secret";
    const failure = jest.spyOn(service, "aggregate").mockRejectedValueOnce(new Error(internalMessage));

    try {
      const response = await request("/health");
      const body = await json<Record<string, unknown>>(response);
      expect(response.status).toBe(500);
      expect(body).toEqual({ code: "INTERNAL_ERROR", message: "An internal error occurred.", ok: false });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(JSON.stringify(body)).not.toContain("stack");
    } finally {
      failure.mockRestore();
    }
  });

  it("returns RATE_LIMITED on the sixth sensitive auth request", async () => {
    const rateModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const rateApp = rateModule.createNestApplication({ bodyParser: false });
    configureHttpApplication(rateApp, testConfig());
    await rateApp.listen(0, "127.0.0.1");

    try {
      const rateBaseUrl = await rateApp.getUrl();
      const statuses: number[] = [];
      let sixthBody: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${rateBaseUrl}/api/v1/auth/login`, {
          body: JSON.stringify({ email: `rate-limit-${randomUUID()}@example.test`, password: "invalid-password-123" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        statuses.push(response.status);
        if (attempt === 5) sixthBody = await json<Record<string, unknown>>(response);
      }

      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
      expect(sixthBody).toEqual(expect.objectContaining({ code: "RATE_LIMITED", ok: false }));
    } finally {
      await rateApp.close();
    }
  });

  it("completes register, catalog, checkout, and CRM sale flow", async () => {
    const fixture = productOrThrow();
    const cart = guestCartOrThrow();
    const suffix = randomUUID().replaceAll("-", "");
    const email = `acceptance-customer-${suffix}@example.test`;
    const password = `Phase10-${suffix}-Customer!`;

    const registration = await request("/api/v1/auth/register", { body: { email, password }, method: "POST" });
    expect(registration.status).toBe(201);
    const registered = await json<AuthResponse>(registration);
    fixtureScope.userIds.push(registered.user.id);

    const login = await request("/api/v1/auth/login", { body: { email, password }, method: "POST" });
    expect(login.status).toBe(200);
    const session = await json<AuthResponse>(login);

    const catalogResponse = await request("/api/v1/products?limit=100");
    expect(catalogResponse.status).toBe(200);
    const catalog = await json<ProductPageResponse>(catalogResponse);
    expect(catalog.items.some((item) => item.id === fixture.productId)).toBe(true);

    const quoteResponse = await request("/api/v1/checkout/quote", {
      body: {
        items: [{ productId: fixture.productId, quantity: 1, variantId: fixture.variantId }],
        sessionToken: cart.sessionToken,
        shippingMethodId: "andreani:envío-a-domicilio",
      },
      method: "POST",
      token: session.accessToken,
    });
    expect(quoteResponse.status).toBe(200);
    const quote = await json<QuoteResponse>(quoteResponse);
    expect(quote).toEqual(expect.objectContaining({ ok: true, subtotal: 50, total: 150 }));

    const completionResponse = await request("/api/v1/checkout/complete", {
      body: {
        address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
        customer: { email, firstName: "Phase", lastName: "Customer" },
        idempotencyKey: `acceptance-completion-${suffix}`,
        items: [{ productId: fixture.productId, quantity: 1, variantId: fixture.variantId }],
        paymentMethodId: "bank-transfer",
        paymentOptionId: "direct-transfer",
        quoteId: quote.quoteId,
        sessionToken: quote.sessionToken,
        shippingMethodId: "andreani:envío-a-domicilio",
      },
      method: "POST",
      token: session.accessToken,
    });
    expect(completionResponse.status).toBe(201);
    const completion = await json<CompletionResponse>(completionResponse);
    expect(completion).toEqual(expect.objectContaining({ ok: true, status: "pending", total: 150 }));

    const salesResponse = await request(`/api/v1/admin/sales?limit=100&page=1&search=${encodeURIComponent(email)}`, { token: adminToken });
    expect(salesResponse.status).toBe(200);
    const sales = await json<SalesPageResponse>(salesResponse);
    expect(sales.items.some((sale) => sale.id === completion.orderId)).toBe(true);
  });

  function healthServiceOrThrow(): HealthService {
    if (!healthService) throw new Error("Acceptance health service was not initialized.");
    return healthService;
  }

  function productOrThrow(): DomainProductFixture {
    if (!product) throw new Error("Acceptance product fixture was not initialized.");
    return product;
  }

  function guestCartOrThrow(): DomainCartFixture {
    if (!guestCart) throw new Error("Acceptance guest cart fixture was not initialized.");
    return guestCart;
  }

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    return fetch(`${baseUrl}${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers,
      method: options.method ?? "GET",
    });
  }
});

function testConfig(): AppConfig {
  return {
    bodyLimitBytes: 104_857,
    corsOrigin: ALLOWED_ORIGIN,
    corsOrigins: [ALLOWED_ORIGIN],
    databaseUrl: process.env["DATABASE_URL"] ?? "",
    frontendUrl: ALLOWED_ORIGIN,
    jwtAccessSecret: process.env["JWT_ACCESS_SECRET"] ?? "",
    jwtAccessTtlSeconds: 900,
    jwtRefreshSecret: process.env["JWT_REFRESH_SECRET"] ?? "",
    jwtRefreshTtlSeconds: 2_592_000,
    nodeEnv: "test",
    port: 3001,
    throttleLimit: 100,
    throttleTtlSeconds: 60,
  };
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  token?: string;
}

interface AuthUser {
  email: string;
  id: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface ProductSummary {
  id: string;
}

interface ProductPageResponse {
  items: ProductSummary[];
}

interface QuoteResponse {
  ok: true;
  quoteId: string;
  sessionToken?: string;
  subtotal: number;
  total: number;
}

interface CompletionResponse {
  ok: true;
  orderId: string;
  status: string;
  total: number;
}

interface SaleSummary {
  id: string;
}

interface SalesPageResponse {
  items: SaleSummary[];
}
