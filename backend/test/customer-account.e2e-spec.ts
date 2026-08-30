import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../src/common/prisma/prisma.service";
import { CatalogVisibility, Role, StockMode } from "../src/generated/prisma/enums";
import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import {
  RESET_DELIVERY_PORT,
  type PasswordResetDelivery,
  type ResetDeliveryPort,
} from "../src/modules/auth/reset-delivery.port";
import type { AppConfig } from "../src/config/app.config";

describe("customer account API (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let fixtures: AccountFixtures | undefined;
  let ownerSession: SessionFixture;
  let foreignSession: SessionFixture;
  let adminSession: SessionFixture;
  let limitSession: SessionFixture;
  const deliveries: PasswordResetDelivery[] = [];

  beforeAll(async () => {
    const resetDelivery: ResetDeliveryPort = {
      deliverPasswordReset: async (delivery) => {
        deliveries.push(delivery);
      },
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RESET_DELIVERY_PORT)
      .useValue(resetDelivery)
      .compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    prismaForHelpers = database;
    fixtures = await createFixtures(database);

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, testConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();

    const fixture = requireFixtures(fixtures);
    ownerSession = await login(fixture.owner);
    foreignSession = await login(fixture.foreign);
    adminSession = await login(fixture.admin);
    limitSession = await login(fixture.limit);
  });

  afterAll(async () => {
    if (prisma && fixtures) {
      await deleteFixtures(prisma, fixtures);
    }
    if (app) {
      await app.close();
    }
  });

  it("denies unauthenticated, foreign, and admin account access", async () => {
    const ownedAddress = await ensureOwnedAddress();

    await expectError(await request("/account/profile"), 401, "UNAUTHORIZED");
    await expectError(await request("/wishlist"), 401, "UNAUTHORIZED");
    await expectError(await request("/account/profile", { token: adminSession.accessToken }), 403, "FORBIDDEN");
    await expectError(await request("/wishlist", { token: adminSession.accessToken }), 403, "FORBIDDEN");

    const foreignAddresses = await request("/account/addresses", { token: foreignSession.accessToken });
    expect(foreignAddresses.status).toBe(200);
    await expectJson(foreignAddresses, []);
    await expectError(
      await request(`/account/addresses/${ownedAddress.id}`, {
        body: addressInput("foreign-attempt"),
        method: "PUT",
        token: foreignSession.accessToken,
      }),
      404,
      "NOT_FOUND",
    );
    await expectError(
      await request(`/account/addresses/${ownedAddress.id}`, {
        method: "DELETE",
        token: foreignSession.accessToken,
      }),
      404,
      "NOT_FOUND",
    );
  });

  it("supports the profile lifecycle without accepting client-owned identity or secrets", async () => {
    const fixture = requireFixtures(fixtures);
    const update = {
      birthDate: "1990-01-01",
      dni: "12345678",
      firstName: "Fixture",
      gender: "other",
      lastName: "Customer",
      phone: "+54 11 5555-5555",
    };
    const updatedResponse = await request("/account/profile", {
      body: update,
      method: "PUT",
      token: ownerSession.accessToken,
    });
    expect(updatedResponse.status).toBe(200);
    const updated = await json<Record<string, unknown>>(updatedResponse);
    expect(updated).toEqual({ ...update, email: fixture.owner.email });
    expect(updated).not.toHaveProperty("passwordHash");
    expect(updated).not.toHaveProperty("role");

    await expectError(
      await request("/account/profile", {
        body: { ...update, email: "foreign@example.test", passwordHash: "secret", userId: fixture.foreign.id },
        method: "PUT",
        token: ownerSession.accessToken,
      }),
      400,
      "VALIDATION_ERROR",
    );
    await expect(prismaOrThrow().user.findUnique({ where: { id: fixture.owner.id } })).resolves.toEqual(
      expect.objectContaining({ email: fixture.owner.email }),
    );
  });

  it("supports owned address create, update, list, and delete", async () => {
    await ensureOwnedAddress();
    const createdResponse = await request("/account/addresses", {
      body: addressInput("office"),
      method: "POST",
      token: ownerSession.accessToken,
    });
    expect(createdResponse.status).toBe(201);
    const created = await json<AccountAddressResponse>(createdResponse);

    const updatedResponse = await request(`/account/addresses/${created.id}`, {
      body: { ...addressInput("office-updated"), city: "Cordoba" },
      method: "PUT",
      token: ownerSession.accessToken,
    });
    expect(updatedResponse.status).toBe(200);
    await expectJson(updatedResponse, { id: created.id, city: "Cordoba", label: "office-updated" });

    const listedResponse = await request("/account/addresses", { token: ownerSession.accessToken });
    expect(listedResponse.status).toBe(200);
    const listed = await json<AccountAddressResponse[]>(listedResponse);
    expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id, label: "office-updated" })]));

    const deletedResponse = await request(`/account/addresses/${created.id}`, {
      method: "DELETE",
      token: ownerSession.accessToken,
    });
    expect(deletedResponse.status).toBe(200);
    await expectJson(deletedResponse, { ok: true });
    const afterDelete = await request(`/account/addresses/${created.id}`, { token: ownerSession.accessToken });
    expect(afterDelete.status).toBe(404);
  });

  it("enforces the six-address limit for concurrent HTTP creates", async () => {
    const requests = Array.from({ length: 8 }, (_, index) => request("/account/addresses", {
      body: addressInput(`limit-${index}`),
      method: "POST",
      token: limitSession.accessToken,
    }));
    const responses = await Promise.all(requests);
    const createdResponses = responses.filter((response) => response.status === 201);
    const limitedResponses = responses.filter((response) => response.status === 409);

    expect(createdResponses).toHaveLength(6);
    expect(limitedResponses).toHaveLength(2);
    for (const response of limitedResponses) {
      await expectJson(response, { code: "ADDRESS_LIMIT_REACHED", ok: false });
    }

    const createdAddresses = await Promise.all(createdResponses.map((response) => json<AccountAddressResponse>(response)));
    await Promise.all(createdAddresses.map((address) => request(`/account/addresses/${address.id}`, {
      method: "DELETE",
      token: limitSession.accessToken,
    })));
    const remaining = await request("/account/addresses", { token: limitSession.accessToken });
    expect(await json<AccountAddressResponse[]>(remaining)).toEqual([]);
  });

  it("keeps password changes safe and revokes prior refresh sessions", async () => {
    const fixture = requireFixtures(fixtures);
    const previousPassword = fixture.owner.password;
    const replacementPassword = `Change-${randomUUID()}-A1!`;

    await expectError(
      await request("/auth/change-password", {
        body: { currentPassword: "wrong-current-password", newPassword: replacementPassword },
        method: "POST",
        token: ownerSession.accessToken,
      }),
      401,
      "INVALID_CREDENTIALS",
    );
    expect((await login(fixture.owner)).accessToken).toEqual(expect.any(String));

    const changedResponse = await request("/auth/change-password", {
      body: { currentPassword: previousPassword, newPassword: replacementPassword },
      method: "POST",
      token: ownerSession.accessToken,
    });
    expect(changedResponse.status).toBe(200);
    await expectJson(changedResponse, { ok: true });

    const staleRefresh = await request("/auth/refresh", {
      headers: { cookie: ownerSession.cookie },
      method: "POST",
    });
    await expectError(staleRefresh, 401, "UNAUTHORIZED");
    await expectError(
      await request("/auth/login", {
        body: { email: fixture.owner.email, password: previousPassword },
        method: "POST",
      }),
      401,
      "INVALID_CREDENTIALS",
    );

    fixture.owner.password = replacementPassword;
    ownerSession = await login(fixture.owner);
  });

  it("returns generic forgot-password responses and consumes reset tokens once", async () => {
    const fixture = requireFixtures(fixtures);
    const passwordBeforeReset = fixture.owner.password;
    deliveries.length = 0;
    const knownResponse = await request("/auth/forgot-password", {
      body: { email: fixture.owner.email.toUpperCase() },
      method: "POST",
    });
    const unknownResponse = await request("/auth/forgot-password", {
      body: { email: `unknown-${fixture.suffix}@example.test` },
      method: "POST",
    });
    expect(knownResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(200);
    const knownBody = await json<Record<string, unknown>>(knownResponse);
    const unknownBody = await json<Record<string, unknown>>(unknownResponse);
    expect(unknownBody).toEqual(knownBody);
    expect(knownBody).toEqual({ ok: true });
    expect(knownBody).not.toHaveProperty("token");
    expect(deliveries).toHaveLength(1);

    const delivery = deliveries[0];
    if (!delivery) throw new Error("Expected a captured reset delivery.");
    const storedToken = await prismaOrThrow().passwordResetToken.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { userId: fixture.owner.id },
    });
    expect(storedToken.tokenHash).not.toBe(delivery.token);

    const resetPassword = `Reset-${randomUUID()}-A1!`;
    const resetResponse = await request("/auth/reset-password", {
      body: { password: resetPassword, token: delivery.token },
      method: "POST",
    });
    expect(resetResponse.status).toBe(200);
    await expectJson(resetResponse, { ok: true });
    await expectError(
      await request("/auth/reset-password", {
        body: { password: `Reused-${randomUUID()}-A1!`, token: delivery.token },
        method: "POST",
      }),
      400,
      "INVALID_RESET_TOKEN",
    );

    fixture.owner.password = resetPassword;
    ownerSession = await login(fixture.owner);
    await expectError(
      await request("/auth/login", {
        body: { email: fixture.owner.email, password: passwordBeforeReset },
        method: "POST",
      }),
      401,
      "INVALID_CREDENTIALS",
    );
  });

  it("keeps wishlist visibility, duplicate handling, ownership, and missing relations controlled", async () => {
    const fixture = requireFixtures(fixtures);
    const addResponse = await request(`/wishlist/${fixture.visibleProduct.id}`, {
      method: "POST",
      token: ownerSession.accessToken,
    });
    expect(addResponse.status).toBe(201);
    await expectJson(addResponse, { ok: true });
    await expectError(
      await request(`/wishlist/${fixture.visibleProduct.id}`, {
        method: "POST",
        token: ownerSession.accessToken,
      }),
      409,
      "WISHLIST_ITEM_EXISTS",
    );
    await expectError(
      await request(`/wishlist/${fixture.hiddenProduct.id}`, {
        method: "POST",
        token: ownerSession.accessToken,
      }),
      404,
      "PRODUCT_NOT_FOUND",
    );
    await expectError(
      await request(`/wishlist/missing-${fixture.suffix}`, {
        method: "POST",
        token: ownerSession.accessToken,
      }),
      404,
      "PRODUCT_NOT_FOUND",
    );

    const listedResponse = await request("/wishlist", { token: ownerSession.accessToken });
    expect(listedResponse.status).toBe(200);
    const listed = await json<Array<Record<string, unknown>>>(listedResponse);
    expect(listed).toEqual([expect.objectContaining({ id: fixture.visibleProduct.id, price: 49.99 })]);
    expect(listed[0]).not.toHaveProperty("userId");

    const foreignList = await request("/wishlist", { token: foreignSession.accessToken });
    await expectJson(foreignList, []);
    await expectError(
      await request(`/wishlist/${fixture.visibleProduct.id}`, {
        method: "DELETE",
        token: foreignSession.accessToken,
      }),
      404,
      "WISHLIST_ITEM_NOT_FOUND",
    );
    await expectJson(
      await request(`/wishlist/${fixture.visibleProduct.id}`, {
        method: "DELETE",
        token: ownerSession.accessToken,
      }),
      { ok: true },
    );
    await expectError(
      await request(`/wishlist/${fixture.visibleProduct.id}`, {
        method: "DELETE",
        token: ownerSession.accessToken,
      }),
      404,
      "WISHLIST_ITEM_NOT_FOUND",
    );
  });

  it("returns an empty order collection instead of inventing account history", async () => {
    const response = await request("/account/orders", { token: ownerSession.accessToken });

    expect(response.status).toBe(200);
    await expectJson(response, []);
  });

  async function ensureOwnedAddress(): Promise<AccountAddressResponse> {
    const existing = await request("/account/addresses", { token: ownerSession.accessToken });
    const addresses = await json<AccountAddressResponse[]>(existing);
    if (addresses[0]) return addresses[0];

    const response = await request("/account/addresses", {
      body: addressInput("home"),
      method: "POST",
      token: ownerSession.accessToken,
    });
    expect(response.status).toBe(201);
    return json<AccountAddressResponse>(response);
  }

  async function login(user: UserFixture): Promise<SessionFixture> {
    const response = await request("/auth/login", {
      body: { email: user.email, password: user.password },
      method: "POST",
    });
    expect(response.status).toBe(200);
    const body = await json<{ accessToken: string }>(response);
    const cookieHeader = response.headers.get("set-cookie");
    if (!cookieHeader) throw new Error("Expected the login response to set a refresh cookie.");
    return {
      accessToken: body.accessToken,
      cookie: cookieHeader.split(";", 1)[0] ?? "",
    };
  }

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    return fetch(`${baseUrl}/api/v1${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers,
      method: options.method ?? "GET",
    });
  }
});

async function createFixtures(prisma: PrismaService): Promise<AccountFixtures> {
  const suffix = randomUUID();
  const owner = await createUser(prisma, "owner", Role.CUSTOMER, suffix);
  const foreign = await createUser(prisma, "foreign", Role.CUSTOMER, suffix);
  const admin = await createUser(prisma, "admin", Role.ADMIN, suffix);
  const limit = await createUser(prisma, "limit", Role.CUSTOMER, suffix);
  const categoryId = `account-e2e-category-${suffix}`;
  await prisma.category.create({
    data: {
      id: categoryId,
      name: "Customer account e2e fixture category",
      slug: `customer-account-e2e-category-${suffix}`,
      sortOrder: 1,
      visibility: CatalogVisibility.VISIBLE,
    },
  });
  const visibleProduct = await createProduct(prisma, suffix, categoryId, "visible", CatalogVisibility.VISIBLE);
  const hiddenProduct = await createProduct(prisma, suffix, categoryId, "hidden", CatalogVisibility.HIDDEN);

  return {
    admin,
    categoryId,
    foreign,
    hiddenProduct,
    limit,
    owner,
    suffix,
    visibleProduct,
  };
}

async function createUser(
  prisma: PrismaService,
  label: string,
  role: Role,
  suffix: string,
): Promise<UserFixture> {
  const id = `account-e2e-${label}-${suffix}`;
  const email = `account-e2e-${label}-${suffix}@example.test`;
  const password = `Ephemeral-${label}-${suffix}-A1!`;
  await prisma.user.create({
    data: {
      email,
      id,
      passwordHash: await bcrypt.hash(password, 4),
      role,
    },
  });
  return { email, id, password };
}

async function createProduct(
  prisma: PrismaService,
  suffix: string,
  categoryId: string,
  label: string,
  visibility: CatalogVisibility,
): Promise<ProductFixture> {
  const id = `account-e2e-product-${label}-${suffix}`;
  const publicSlug = `customer-account-e2e-${label}-${suffix}`;
  await prisma.product.create({
    data: {
      brand: "EntrenAR Fixture",
      id,
      name: `Customer account e2e ${label} product`,
      publicSlug,
      quantity: 8,
      salePrice: "49.99",
      sku: `ACCOUNT-E2E-${label.toUpperCase()}-${suffix}`,
      slug: `customer-account-e2e-admin-${label}-${suffix}`,
      stockMode: StockMode.TRACKED,
      visibility,
    },
  });
  await prisma.productCategory.create({ data: { categoryId, productId: id } });
  return { id, publicSlug };
}

async function deleteFixtures(prisma: PrismaService, fixtures: AccountFixtures): Promise<void> {
  const userIds = [fixtures.owner.id, fixtures.foreign.id, fixtures.admin.id, fixtures.limit.id];
  const productIds = [fixtures.visibleProduct.id, fixtures.hiddenProduct.id];
  await prisma.wishlistItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.productCategory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({ where: { id: fixtures.categoryId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

function addressInput(label: string) {
  return {
    city: "Buenos Aires",
    label,
    phone: "+54 11 5555-5555",
    postalCode: "C1000",
    province: "Buenos Aires",
    recipient: "Fixture Customer",
    street: "123 Test Street",
  };
}

function testConfig(): AppConfig {
  return {
    bodyLimitBytes: 104_857,
    corsOrigin: "http://localhost:3000",
    databaseUrl: process.env["DATABASE_URL"] ?? "",
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

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expectJson(response, { code, ok: false });
}

async function expectJson(response: Response, expected: unknown): Promise<void> {
  const actual = await json<unknown>(response);
  if (Array.isArray(expected)) {
    expect(actual).toEqual(expected);
    return;
  }

  expect(actual).toEqual(expect.objectContaining(expected as object));
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function requireFixtures(value: AccountFixtures | undefined): AccountFixtures {
  if (!value) throw new Error("Customer account e2e fixtures were not initialized.");
  return value;
}

function prismaOrThrow(): PrismaService {
  if (!prismaForHelpers) throw new Error("The e2e Prisma service was not initialized.");
  return prismaForHelpers;
}

let prismaForHelpers: PrismaService | undefined;

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "POST" | "PUT";
  token?: string;
}

interface AccountFixtures {
  admin: UserFixture;
  categoryId: string;
  foreign: UserFixture;
  hiddenProduct: ProductFixture;
  limit: UserFixture;
  owner: UserFixture;
  suffix: string;
  visibleProduct: ProductFixture;
}

interface AccountAddressResponse {
  city: string;
  id: string;
  label: string;
  phone: string;
  postalCode: string;
  province: string;
  recipient: string;
  street: string;
}

interface ProductFixture {
  id: string;
  publicSlug: string;
}

interface SessionFixture {
  accessToken: string;
  cookie: string;
}

interface UserFixture {
  email: string;
  id: string;
  password: string;
}
