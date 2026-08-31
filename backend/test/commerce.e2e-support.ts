import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import type { AppConfig } from "../src/config/app.config";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { cleanupFixtures, createFixtures, type CommerceFixtures, type FixtureRecords } from "./commerce.e2e-fixtures";

export interface CommerceE2eTestContext {
  appOrThrow(): INestApplication;
  captureExternalFetches<T>(callback: () => Promise<T>): Promise<string[]>;
  prismaOrThrow(): PrismaService;
  readCommerceState(token: string): Promise<CommerceState>;
  request(path: string, options?: RequestOptions): Promise<Response>;
  start(): Promise<void>;
  stop(): Promise<void>;
  withFixtures<T>(callback: (fixtures: CommerceFixtures) => Promise<T>): Promise<T>;
}

export function createCommerceE2eTestContext(): CommerceE2eTestContext {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let authService: AuthService | undefined;

  async function start(): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const database = moduleFixture.get(PrismaService);
    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });

    configureHttpApplication(nestApp, testConfig());
    await nestApp.listen(0, "127.0.0.1");

    app = nestApp;
    baseUrl = await nestApp.getUrl();
    prisma = database;
    authService = moduleFixture.get(AuthService);
  }

  async function stop(): Promise<void> {
    try {
      if (app) await app.close();
    } finally {
      app = undefined;
      baseUrl = "";
      prisma = undefined;
      authService = undefined;
    }
  }

  async function withFixtures<T>(callback: (fixtures: CommerceFixtures) => Promise<T>): Promise<T> {
    let records: FixtureRecords | undefined;

    try {
      records = await createFixtures(prismaOrThrow());
      const service = authServiceOrThrow();
      const [adminSession, customerSession] = await Promise.all([
        service.login(records.admin.email, records.admin.password),
        service.login(records.customer.email, records.customer.password),
      ]);

      return await callback({
        ...records,
        adminToken: adminSession.accessToken,
        customerToken: customerSession.accessToken,
      });
    } finally {
      if (records) await cleanupFixtures(prismaOrThrow(), records);
    }
  }

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set("content-type", "application/json");

    return fetch(`${baseUrlForRequest()}${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers,
      method: options.method ?? "GET",
    });
  }

  async function readCommerceState(token: string): Promise<CommerceState> {
    const responses = await Promise.all([
      request("/admin/payment-methods", { token }),
      request("/admin/shipping/providers", { token }),
      request("/admin/pickup-points", { token }),
      request("/admin/discounts/coupons", { token }),
      request("/admin/discounts/shipping", { token }),
    ]);

    for (const response of responses) expect(response.status).toBe(200);

    const [paymentMethods, shippingProviders, pickupPoints, coupons, shippingDiscounts] = await Promise.all(
      responses.map((response) => json<unknown>(response)),
    );

    return { coupons, paymentMethods, pickupPoints, shippingDiscounts, shippingProviders };
  }

  async function captureExternalFetches<T>(callback: () => Promise<T>): Promise<string[]> {
    const externalCalls: string[] = [];
    const previousFetch = globalThis.fetch;
    const originalFetch = previousFetch.bind(globalThis);

    globalThis.fetch = async (input, init) => {
      const target = fetchTarget(input);
      if (!target.startsWith(baseUrl)) externalCalls.push(target);
      return originalFetch(input, init);
    };

    try {
      await callback();
    } finally {
      globalThis.fetch = previousFetch;
    }

    return externalCalls;
  }

  function baseUrlForRequest(): string {
    if (!baseUrl) throw new Error("Commerce e2e application was not initialized.");
    return `${baseUrl}/api/v1`;
  }

  function appOrThrow(): INestApplication {
    if (!app) throw new Error("Commerce e2e application was not initialized.");
    return app;
  }

  function prismaOrThrow(): PrismaService {
    if (!prisma) throw new Error("Commerce e2e Prisma service was not initialized.");
    return prisma;
  }

  function authServiceOrThrow(): AuthService {
    if (!authService) throw new Error("Commerce e2e AuthService was not initialized.");
    return authService;
  }

  return {
    appOrThrow,
    captureExternalFetches,
    prismaOrThrow,
    readCommerceState,
    request,
    start,
    stop,
    withFixtures,
  };
}

export async function expectJson(response: Response, expected: unknown): Promise<void> {
  const actual = await json<unknown>(response);
  if (Array.isArray(expected)) {
    expect(actual).toEqual(expected);
    return;
  }

  expect(actual).toEqual(expect.objectContaining(expected as object));
}

export async function expectProtectedError(
  response: Response,
  status: number,
  code: "FORBIDDEN" | "UNAUTHORIZED",
  secrets: readonly string[],
): Promise<void> {
  expect(response.status).toBe(status);
  const body = await json<Record<string, unknown>>(response);
  expect(body).toEqual({ code, message: code === "FORBIDDEN" ? "Forbidden." : "Unauthorized.", ok: false });
  assertNoSensitiveKeys(body);
  assertNoSensitiveStrings(body, secrets);
}

export async function expectSafeError(
  response: Response,
  status: number,
  code: string,
  secrets: readonly string[],
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);
  const body = await json<Record<string, unknown>>(response);
  expect(body).toEqual(expect.objectContaining({ code, message: expect.any(String), ok: false }));
  expect(Object.keys(body).every((key) => ["code", "issues", "message", "ok"].includes(key))).toBe(true);
  assertNoSensitiveKeys(body);
  assertNoSensitiveStrings(body, secrets);
  return body;
}

export function assertNoSensitiveKeys(value: unknown): void {
  const sensitiveKeys = new Set([
    "accessToken",
    "actorId",
    "connectionString",
    "couponId",
    "deletedAt",
    "passwordHash",
    "query",
    "refreshToken",
    "stack",
    "token",
    "tokenHash",
    "userId",
  ]);

  if (Array.isArray(value)) {
    for (const entry of value) assertNoSensitiveKeys(entry);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, entry] of Object.entries(value)) {
    expect(sensitiveKeys.has(key)).toBe(false);
    assertNoSensitiveKeys(entry);
  }
}

export function assertNoSensitiveStrings(value: unknown, secrets: readonly string[]): void {
  if (typeof value === "string") {
    for (const secret of secrets) {
      if (secret.length > 0) expect(value).not.toContain(secret);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) assertNoSensitiveStrings(entry, secrets);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const entry of Object.values(value)) assertNoSensitiveStrings(entry, secrets);
}

export function sensitiveValues(fixtures: CommerceFixtures): string[] {
  return [
    fixtures.admin.password,
    fixtures.customer.password,
    fixtures.adminToken,
    fixtures.customerToken,
    process.env["DATABASE_URL"] ?? "",
  ];
}

export async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function fetchTarget(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
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

export interface RequestOptions {
  body?: unknown;
  method?: "DELETE" | "GET" | "POST" | "PUT";
  token?: string;
}

export interface ProtectedRoute {
  body?: unknown;
  method: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
}

export interface UnsupportedRoute {
  method: "GET";
  path: string;
}

export interface CommerceState {
  coupons: unknown;
  paymentMethods: unknown;
  pickupPoints: unknown;
  shippingDiscounts: unknown;
  shippingProviders: unknown;
}

export interface BankTransferResponse {
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
  holderName: string;
}

export interface PaymentOptionResponse {
  fee: string;
  id: string;
  receiveIn: string;
  salesIn: string;
}

export interface PaymentMethodResponse {
  bankConfig?: BankTransferResponse;
  id: string;
  options: PaymentOptionResponse[];
  selectedOptionId?: string;
  status: string;
}

export interface WeightBandResponse {
  cost: number;
  id: string;
  maxGrams: number | null;
  minGrams: number;
}

export interface ShippingProviderResponse {
  id: string;
  status: string;
  weightRanges: WeightBandResponse[];
}

export interface PickupPointResponse {
  costType: string;
  fixedCost?: number;
  id: string;
  isMain: boolean;
  schedule: PickupScheduleResponse[];
  status: string;
}

export interface PickupScheduleResponse {
  day: string;
  from: string;
  id: string;
  to: string;
}

export interface CouponHistoryResponse {
  action: string;
  userName: string;
}

export interface CouponResponse {
  code: string;
  discountType: string;
  discountValue?: number;
  history: CouponHistoryResponse[];
  id: string;
  status: string;
}

export interface ShippingDiscountResponse {
  categoryIds: string[];
  id: string;
  shippingMethodIds: string[];
  status: string;
  targetType: string;
  zoneIds: string[];
  zoneTargetType: string;
}
