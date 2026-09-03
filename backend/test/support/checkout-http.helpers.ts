import type { AppConfig } from "../../src/config/app.config";

import {
  HTTP_METHOD,
  type CheckoutCompleteResponse,
  type CheckoutFixtures,
  type CheckoutQuoteResponse,
  type FixtureUser,
  type ProductFixture,
  type RequestOptions,
  type SessionFixture,
} from "./checkout-http.types";

export async function loginCheckoutUser(baseUrl: string, user: FixtureUser): Promise<SessionFixture> {
  const response = await checkoutRequest(baseUrl, "/auth/login", {
    body: { email: user.email, password: user.password },
    method: HTTP_METHOD.POST,
  });
  expect(response.status).toBe(200);
  const body = await checkoutJson<{ accessToken: string }>(response);
  return { accessToken: body.accessToken };
}

export function checkoutRequest(baseUrl: string, path: string, options: RequestOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers,
    method: options.method ?? HTTP_METHOD.POST,
  });
}

export function checkoutQuoteBody(product: ProductFixture, sessionToken: string | undefined, shippingMethodId?: string): object {
  return {
    ...(sessionToken ? { sessionToken } : {}),
    ...(shippingMethodId ? { shippingMethodId } : {}),
    items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
  };
}

export function checkoutCompleteBody(
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

export async function checkoutJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function expectCheckoutError(response: Response, status: number, code: string): Promise<void> {
  const body = await checkoutJson<Record<string, unknown>>(response);
  if (response.status !== status) {
    throw new Error(`Expected ${status}/${code}, received ${response.status}/${String(body.code)}: ${JSON.stringify(body)}`);
  }
  expect(body).toEqual(expect.objectContaining({ code, ok: false }));
}

export async function expectCheckoutJson(response: Response, expected: unknown): Promise<void> {
  const actual = await checkoutJson<unknown>(response);
  if (Array.isArray(expected)) {
    expect(actual).toEqual(expected);
    return;
  }
  expect(actual).toEqual(expect.objectContaining(expected as object));
}

export function requireCheckoutFixtures(value: CheckoutFixtures | undefined): CheckoutFixtures {
  if (!value) throw new Error("Checkout e2e fixtures were not initialized.");
  return value;
}

export function testCheckoutConfig(): AppConfig {
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

export async function seedCheckoutHistoryOrder(
  baseUrl: string,
  fixture: CheckoutFixtures,
  session: SessionFixture,
): Promise<void> {
  const quoteResponse = await checkoutRequest(baseUrl, "/checkout/quote", {
    body: checkoutQuoteBody(fixture.customerProduct, fixture.customerCart.sessionToken, "andreani:envío-a-domicilio"),
    token: session.accessToken,
  });
  expect(quoteResponse.status).toBe(200);
  const quote = await checkoutJson<CheckoutQuoteResponse>(quoteResponse);
  const completeResponse = await checkoutRequest(baseUrl, "/checkout/complete", {
    body: checkoutCompleteBody(fixture.customerProduct, quote.sessionToken, quote.quoteId, "account-history-seed-key", fixture.owner.email),
    method: HTTP_METHOD.POST,
    token: session.accessToken,
  });
  expect(completeResponse.status).toBe(201);
  await checkoutJson<CheckoutCompleteResponse>(completeResponse);
}
