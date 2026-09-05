import { createHash, randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { loadAppConfig } from "../src/config/app.config";
import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { AuthService } from "../src/modules/auth/auth.service";
import { CartStatus, CheckoutRecoveryStatus, CheckoutSessionStatus, Role } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("admin abandoned carts API (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let adminToken = "";
  let customerToken = "";
  let adminId = "";
  let customerId = "";
  let customerEmail = "";
  let password = "";
  let product: ProductFixture | undefined;
  let originalSettings: RecoverySettings | null = null;
  const sessionIds: string[] = [];
  const cartIds: string[] = [];
  let emailSessionId = "";
  let manualSessionId = "";
  let convertSessionId = "";
  let discardSessionId = "";

  beforeAll(async () => {
    if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL is required for abandoned-cart e2e tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    const suffix = randomUUID().replaceAll("-", "");
    password = `Abandoned-cart-${suffix}-A1!`;
    adminId = `abandoned-e2e-admin-${suffix}`;
    customerId = `abandoned-e2e-customer-${suffix}`;
    customerEmail = `${customerId}@example.test`;
    const adminEmail = `${adminId}@example.test`;

    const productRecord = await database.product.findFirst({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        variants: {
          orderBy: { id: "asc" },
          select: { id: true, name: true, sku: true },
          take: 1,
        },
      },
    });
    const variant = productRecord?.variants[0];
    if (!productRecord || !variant) throw new Error("The abandoned-cart e2e test requires a seeded product variant.");
    product = { id: productRecord.id, name: productRecord.name, sku: variant.sku, variantId: variant.id, variantName: variant.name };
    originalSettings = await database.cartRecoverySettings.findUnique({ where: { id: "singleton" } });

    await database.user.createMany({ data: [
      { email: adminEmail, id: adminId, passwordHash: await bcrypt.hash(password, 4), role: Role.ADMIN },
      { email: customerEmail, id: customerId, passwordHash: await bcrypt.hash(password, 4), role: Role.CUSTOMER },
    ] });

    emailSessionId = await createFixtureSession(database, "email");
    manualSessionId = await createFixtureSession(database, "manual");
    convertSessionId = await createFixtureSession(database, "convert");
    discardSessionId = await createFixtureSession(database, "discard");

    const authService = moduleFixture.get(AuthService);
    adminToken = (await authService.login(adminEmail, password)).accessToken;
    customerToken = (await authService.login(customerEmail, password)).accessToken;

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, loadAppConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.order.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } });
        await prisma.checkoutSessionHistory.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } });
        await prisma.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } });
        await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
        await prisma.refreshToken.deleteMany({ where: { userId: { in: [adminId, customerId] } } });
        await prisma.user.deleteMany({ where: { id: { in: [adminId, customerId] } } });
        if (originalSettings) {
          await prisma.cartRecoverySettings.update({
            data: {
              emailHtmlBody: originalSettings.emailHtmlBody,
              emailPlainBody: originalSettings.emailPlainBody,
              emailSubject: originalSettings.emailSubject,
              isActive: originalSettings.isActive,
              timing: originalSettings.timing,
            },
            where: { id: originalSettings.id },
          });
        } else {
          await prisma.cartRecoverySettings.deleteMany({ where: { id: "singleton" } });
        }
      }
    } finally {
      if (app) await app.close();
    }
  });

  it("returns 401 without a token and 403 for a CUSTOMER token", async () => {
    await expectError(await request("/admin/abandoned-carts"), 401, "UNAUTHORIZED");
    await expectError(await request("/admin/abandoned-carts/config"), 401, "UNAUTHORIZED");
    await expectError(await request("/admin/abandoned-carts", { token: customerToken }), 403, "FORBIDDEN");
    await expectError(await request(`/admin/abandoned-carts/${emailSessionId}`, { token: customerToken }), 403, "FORBIDDEN");
  });

  it("allows ADMIN reads, route-precedence settings, and validated filters", async () => {
    const query = new URLSearchParams({ limit: "100", page: "1", search: customerEmail });
    const listResponse = await request(`/admin/abandoned-carts?${query.toString()}`, { token: adminToken });
    expect(listResponse.status).toBe(200);
    const list = await json<AbandonedCartListResponse>(listResponse);
    expect(list.total).toBe(4);
    expect(list.items.map((item) => item.id)).toEqual(expect.arrayContaining(sessionIds));

    const detailResponse = await request(`/admin/abandoned-carts/${emailSessionId}`, { token: adminToken });
    expect(detailResponse.status).toBe(200);
    await expect(json<AbandonedCartDetailResponse>(detailResponse)).resolves.toEqual(expect.objectContaining({
      cartId: expect.any(String),
      id: emailSessionId,
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      timeline: expect.any(Array),
    }));

    const configResponse = await request("/admin/abandoned-carts/config", { token: adminToken });
    expect(configResponse.status).toBe(200);
    await expect(json<RecoveryConfig>(configResponse)).resolves.toEqual(expect.objectContaining({ isActive: expect.any(Boolean), timing: expect.any(String) }));

    const templateResponse = await request("/admin/abandoned-carts/template", { token: adminToken });
    expect(templateResponse.status).toBe(200);
    await expect(json<RecoveryTemplate>(templateResponse)).resolves.toEqual(expect.objectContaining({ htmlBody: expect.any(String), plainTextBody: expect.any(String), subject: expect.any(String) }));

    await expectError(await request("/admin/abandoned-carts?page=0", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/abandoned-carts/config", { body: { isActive: true, timing: "unsupported" }, method: "PUT", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/abandoned-carts/template", { body: { htmlBody: "<p>Missing fields</p>" }, method: "PUT", token: adminToken }), 400, "VALIDATION_ERROR");
  });

  it("persists ADMIN config and template updates", async () => {
    const config = { isActive: false, timing: "6hs" };
    const configResponse = await request("/admin/abandoned-carts/config", { body: config, method: "PUT", token: adminToken });
    expect(configResponse.status).toBe(200);
    await expect(json<RecoveryConfig>(configResponse)).resolves.toEqual(config);
    await expect(json<RecoveryConfig>(await request("/admin/abandoned-carts/config", { token: adminToken }))).resolves.toEqual(config);

    const template: RecoveryTemplate = {
      htmlBody: "<p>{{nombre}} · {{total}}</p><a href=\"{{checkoutUrl}}\">Recover</a>",
      plainTextBody: "{{nombre}} {{total}} {{checkoutUrl}}",
      subject: "E2E recovery template",
    };
    const templateResponse = await request("/admin/abandoned-carts/template", { body: template, method: "PUT", token: adminToken });
    expect(templateResponse.status).toBe(200);
    await expect(json<RecoveryTemplate>(templateResponse)).resolves.toEqual(template);
    await expect(json<RecoveryTemplate>(await request("/admin/abandoned-carts/template", { token: adminToken }))).resolves.toEqual(template);
  });

  it("executes email, manual, conversion, and discard actions with actor audit data", async () => {
    const emailResponse = await request(`/admin/abandoned-carts/${emailSessionId}/email`, {
      body: { note: "E2E email" },
      method: "POST",
      token: adminToken,
    });
    expect(emailResponse.status).toBe(200);
    const emailAction = await json<AbandonedCartActionResponse>(emailResponse);
    expect(emailAction.cart.recoveryStatus).toBe(CheckoutRecoveryStatus.SENT);
    const recoveryUrl = emailAction.recoveryLink?.url;
    expect(recoveryUrl).toEqual(expect.stringContaining("recoveryToken="));
    if (!recoveryUrl) throw new Error("The email action did not return a recovery link.");
    const recoveryToken = new URL(recoveryUrl, "http://localhost").searchParams.get("recoveryToken");
    if (!recoveryToken) throw new Error("The recovery link did not contain a token.");
    const persistedEmail = await prismaOrThrow().checkoutSession.findUniqueOrThrow({
      select: { lastEmailSentAt: true, recoveryExpiresAt: true, recoveryTokenHash: true },
      where: { id: emailSessionId },
    });
    expect(persistedEmail.recoveryTokenHash).toBe(createHash("sha256").update(recoveryToken).digest("hex"));
    expect(persistedEmail.lastEmailSentAt).toEqual(expect.any(Date));
    expect(persistedEmail.recoveryExpiresAt).toEqual(expect.any(Date));

    const manualResponse = await request(`/admin/abandoned-carts/${manualSessionId}/manual`, { body: { note: "E2E phone contact" }, method: "POST", token: adminToken });
    expect(manualResponse.status).toBe(200);
    expect((await json<AbandonedCartActionResponse>(manualResponse)).cart.recoveryStatus).toBe(CheckoutRecoveryStatus.MANUAL);
    await expect(prismaOrThrow().checkoutSessionHistory.findFirst({ where: { checkoutSessionId: manualSessionId, eventType: "MANUAL_CONTACT_LOGGED" } })).resolves.toEqual(expect.objectContaining({ actorId: adminId, actorRole: Role.ADMIN, notes: "E2E phone contact" }));

    const convertResponse = await request(`/admin/abandoned-carts/${convertSessionId}/convert`, { body: { notes: "E2E converted" }, method: "POST", token: adminToken });
    expect(convertResponse.status).toBe(200);
    const converted = await json<AbandonedCartActionResponse>(convertResponse);
    expect(converted.cart.recoveryStatus).toBe(CheckoutRecoveryStatus.RECOVERED);
    if (!converted.orderId) throw new Error("The conversion action did not return an order ID.");
    await expect(prismaOrThrow().order.findUnique({ where: { id: converted.orderId } })).resolves.toEqual(expect.objectContaining({ checkoutSessionId: convertSessionId, status: "PENDING" }));

    await expectError(await request(`/admin/abandoned-carts/${discardSessionId}/discard`, { body: {}, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request(`/admin/abandoned-carts/${discardSessionId}/discard`, { body: { reason: "no" }, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    const discarded = await request(`/admin/abandoned-carts/${discardSessionId}/discard`, { body: { reason: "E2E no longer needed" }, method: "POST", token: adminToken });
    expect(discarded.status).toBe(200);
    expect((await json<AbandonedCartActionResponse>(discarded)).cart.recoveryStatus).toBe(CheckoutRecoveryStatus.DISCARDED);
    await expect(prismaOrThrow().checkoutSessionHistory.findFirst({ where: { checkoutSessionId: discardSessionId, eventType: "SESSION_DISCARDED" } })).resolves.toEqual(expect.objectContaining({ actorId: adminId, actorRole: Role.ADMIN, notes: "E2E no longer needed" }));

    await expectError(await request(`/admin/abandoned-carts/${convertSessionId}/manual`, { body: {}, method: "POST", token: adminToken }), 409, "CONFLICT");
    await expectError(await request(`/admin/abandoned-carts/${discardSessionId}/email`, { body: {}, method: "POST", token: adminToken }), 409, "CONFLICT");
  });

  function prismaOrThrow(): PrismaService {
    if (!prisma) throw new Error("Abandoned-cart e2e Prisma service was not initialized.");
    return prisma;
  }

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}/api/v1${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers,
      method: options.method ?? "GET",
    });
  }
  async function createFixtureSession(database: PrismaService, label: string): Promise<string> {
    const fixtureProduct = currentProduct();
    const suffix = randomUUID().replaceAll("-", "");
    const cartId = `abandoned-e2e-cart-${label}-${suffix}`;
    const sessionId = `abandoned-e2e-session-${label}-${suffix}`;
    const createdAt = new Date("2026-09-01T10:00:00.000Z");
    const snapshotData = {
      currency: "ARS",
      customer: { email: currentCustomerEmail(), firstName: "E2E", lastName: "Customer", phone: "+54 11 5555-5555" },
      items: [{ lineSubtotal: 100, name: fixtureProduct.name, productId: fixtureProduct.id, quantity: 1, sku: fixtureProduct.sku, unitPrice: 100, variantId: fixtureProduct.variantId, variantName: fixtureProduct.variantName }],
      subtotal: 100,
      total: 100,
    };

    await database.cart.create({ data: {
      id: cartId,
      items: { create: { productId: fixtureProduct.id, quantity: 1, variantId: fixtureProduct.variantId } },
      status: CartStatus.ABANDONED,
      userId: currentCustomerId(),
    } });
    await database.checkoutSession.create({ data: {
      abandonedAt: createdAt,
      cartId,
      id: sessionId,
      lastActivityAt: createdAt,
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      snapshotData,
      status: CheckoutSessionStatus.ABANDONED,
      tokenHash: createHash("sha256").update(`${sessionId}-token`).digest("hex"),
      userId: currentCustomerId(),
    } });
    await database.checkoutSessionHistory.create({ data: { checkoutSessionId: sessionId, eventType: "SESSION_ABANDONED", actorRole: "SYSTEM", createdAt } });
    sessionIds.push(sessionId);
    cartIds.push(cartId);
    return sessionId;
  }

  function currentProduct(): ProductFixture {
    if (!product) throw new Error("The abandoned-cart e2e product was not initialized.");
    return product;
  }

  function currentCustomerId(): string {
    if (!customerId) throw new Error("The abandoned-cart e2e customer was not initialized.");
    return customerId;
  }

  function currentCustomerEmail(): string {
    if (!customerEmail) throw new Error("The abandoned-cart e2e customer email was not initialized.");
    return customerEmail;
  }
});

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(json<Record<string, unknown>>(response)).resolves.toEqual(expect.objectContaining({ code, ok: false }));
}

function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

interface ProductFixture {
  id: string;
  name: string;
  sku: string;
  variantId: string;
  variantName: string;
}

interface RecoverySettings {
  emailHtmlBody: string;
  emailPlainBody: string;
  emailSubject: string;
  id: string;
  isActive: boolean;
  timing: string;
}

interface RecoveryConfig {
  isActive: boolean;
  timing: string;
}

interface RecoveryTemplate {
  htmlBody: string;
  plainTextBody: string;
  subject: string;
}

interface AbandonedCartListResponse {
  items: Array<{ id: string }>;
  total: number;
}

interface AbandonedCartDetailResponse {
  cartId: string;
  id: string;
  recoveryStatus: string;
  timeline: Array<Record<string, unknown>>;
}

interface AbandonedCartActionResponse {
  cart: { recoveryStatus: string };
  orderId?: string;
  recoveryLink?: { url: string } | null;
}

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: "GET" | "POST" | "PUT";
  token?: string;
}
