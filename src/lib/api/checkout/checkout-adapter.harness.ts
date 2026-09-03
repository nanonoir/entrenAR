import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import type {
  CheckoutApiClient,
  CheckoutApiMethodOptions,
  CheckoutApiRequestOptions,
} from "@/lib/api/checkout/client";
import type {
  CheckoutCompleteInput,
  CheckoutLineItemInput,
  CheckoutQuoteInput,
} from "@/lib/api/checkout/checkout.repository";

const execFileAsync = promisify(execFile);

const API_METHOD = {
  GET: "get",
  POST: "post",
  REQUEST: "request",
} as const;

async function run(): Promise<void> {
  if (process.argv.includes("--api-source")) {
    await runApiSourceScenario();
    return;
  }

  await runSourceScenario();
  await runMockScenario();
  await runApiRepositoryScenario();
  await runFetchClientScenario();
  await runApiSourceScenarioInChild();
  console.log("checkout adapter harness: mock default/API opt-in, DTO authority, guest/auth reconciliation, controlled errors, retry, idempotency, and mock fallback passed");
}

async function runSourceScenario(): Promise<void> {
  const { DATA_SOURCE, getCheckoutDataSource } = await import("@/lib/api/config");
  const { getCheckoutRepository } = await import("./checkout.repository");

  if (!process.env.NEXT_PUBLIC_CHECKOUT_DATA_SOURCE && !process.env.NEXT_PUBLIC_DATA_SOURCE && getCheckoutDataSource() !== DATA_SOURCE.MOCK) {
    throw new Error("Checkout mock source must remain the default when no source is configured.");
  }
  if (getCheckoutRepository(DATA_SOURCE.MOCK) === getCheckoutRepository(DATA_SOURCE.API)) {
    throw new Error("Checkout API source must use a distinct repository.");
  }
}

async function runMockScenario(): Promise<void> {
  const { clearAccountAccessToken, setAccountAccessToken } = await import("@/lib/api/account/client");
  const { getPreviewCartItems } = await import("@/lib/data/cart-preview");
  const { MockCheckoutRepository } = await import("./mock-checkout.repository");

  clearAccountAccessToken();
  const repository = new MockCheckoutRepository();
  const previewItem = getPreviewCartItems()[0];
  if (!previewItem) throw new Error("The preview cart must contain a checkout fixture.");

  const staleClientItem = {
    ...previewItem,
    price: 1,
    stock: 0,
    total: 1,
    userId: "foreign-user",
  } as unknown as CheckoutLineItemInput;
  const input: CheckoutQuoteInput = {
    address: addressInput(),
    deliveryType: "shipping",
    items: [staleClientItem, { ...staleClientItem, quantity: 1 }],
    shippingMethodId: "andreani:envío-a-domicilio",
  };
  const quote = await repository.quote(input);
  const quoteItem = quote.items[0];

  if (
    !quoteItem
    ||
    !quote.sessionToken
    || quoteItem?.quantity !== 2
    || quoteItem.unitPrice !== 78900
    || quote.subtotal !== 157800
    || quote.paymentMethods.length !== 3
    || quote.shipping !== 4200
  ) {
    throw new Error("Mock checkout did not reconcile cart lines or use authoritative catalog values.");
  }

  const completeInput: CheckoutCompleteInput = {
    ...input,
    customer: {
      email: "checkout@example.test",
      firstName: "Checkout",
      lastName: "Customer",
    },
    idempotencyKey: "mock-complete-key",
    paymentMethodId: "bank-transfer",
    paymentOptionId: "direct-transfer",
    quoteId: quote.quoteId,
    sessionToken: quote.sessionToken,
  };
  const completed = await repository.complete(completeInput);
  const replay = await repository.complete(completeInput);

  if (
    completed.orderId.length === 0
    || completed.total !== quote.total
    || replay.orderId !== completed.orderId
    || replay.number !== completed.number
  ) {
    throw new Error("Mock checkout completion or idempotent replay failed.");
  }

  const reconciliationRepository = new MockCheckoutRepository();
  clearAccountAccessToken();
  const guestQuote = await reconciliationRepository.quote({
    items: [{ productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" }],
  });
  if (!guestQuote.sessionToken) throw new Error("Guest checkout did not issue a session token.");
  setAccountAccessToken("mock-authenticated-token");
  await reconciliationRepository.quote({
    items: [{ productId: "p-whey-pro", quantity: 1, variantId: "chocolate-900" }],
  });
  const mergedQuote = await reconciliationRepository.quote({
    items: [{ productId: "p-whey-pro", quantity: 1, variantId: "chocolate-900" }],
    sessionToken: guestQuote.sessionToken,
  });
  clearAccountAccessToken();

  if (mergedQuote.items.length !== 2 || !mergedQuote.sessionToken) {
    throw new Error("Guest and authenticated checkout carts were not reconciled.");
  }
}

async function runApiRepositoryScenario(): Promise<void> {
  const { CheckoutApiError } = await import("./client");
  const { CheckoutApiRepository } = await import("./api-checkout.repository");
  const calls: ClientCall[] = [];
  const repository = new CheckoutApiRepository(createClient(calls, (call) => {
    if (call.method !== API_METHOD.POST) throw new Error(`Unexpected checkout method: ${call.method}`);
    if (call.path === "/checkout/quote") return rawQuoteResponse();
    if (call.path === "/checkout/complete") return rawCompleteResponse();
    throw new Error(`Unexpected checkout path: ${call.path}`);
  }));
  const unsafeItem = {
    productId: "server-product",
    quantity: 1,
    variantId: "server-variant",
    price: 1,
    stock: 0,
    total: 1,
    userId: "foreign-user",
  } as unknown as CheckoutLineItemInput;
  const quote = await repository.quote({ items: [unsafeItem], sessionToken: "guest-session-token" });
  const quoteCall = calls.find((call) => call.path === "/checkout/quote");
  const sentQuoteItem = isRecord(quoteCall?.body) && Array.isArray(quoteCall.body.items) ? quoteCall.body.items[0] : undefined;

  if (
    quote.items[0]?.unitPrice !== 42.5
    || quote.items[0]?.lineSubtotal !== 42.5
    || !isRecord(sentQuoteItem)
    || Object.keys(sentQuoteItem).some((key) => !["productId", "quantity", "variantId"].includes(key))
  ) {
    throw new Error("Checkout API DTO mapping or server-owned input filtering failed.");
  }

  const completion = await repository.complete({
    customer: {
      email: "customer@example.test",
      firstName: "API",
      lastName: "Customer",
    },
    idempotencyKey: "api-complete-key",
    items: [unsafeItem],
    paymentMethodId: "bank-transfer",
    sessionToken: "guest-session-token",
  });
  const completeCall = calls.find((call) => call.path === "/checkout/complete");
  const completeBody = completeCall?.body;

  if (
    completion.orderId !== "server-order"
    || completion.total !== 42.5
    || !isRecord(completeBody)
    || "total" in completeBody
    || "userId" in completeBody
    || "price" in completeBody
  ) {
    throw new Error("Checkout completion mapping or server-owned input filtering failed.");
  }

  try {
    await repository.quote({ items: [] });
    throw new Error("Expected controlled checkout validation error.");
  } catch (error) {
    if (!(error instanceof CheckoutApiError) || error.code !== "VALIDATION_ERROR" || error.status !== 400 || error.ok !== false) {
      throw error;
    }
  }
}

async function runFetchClientScenario(): Promise<void> {
  const { CheckoutApiError, FetchCheckoutApiClient } = await import("./client");
  const { clearAccountAccessToken, getAccountAccessToken, setAccountAccessToken } = await import("@/lib/api/account/client");
  const calls: FetchCall[] = [];
  let protectedAttempts = 0;

  setAccountAccessToken("stale-checkout-token");
  const client = new FetchCheckoutApiClient(async (input, init) => {
    const call = fetchCall(input, init);
    calls.push(call);
    if (call.path === "/checkout/protected" && protectedAttempts++ === 0) return jsonResponse({ code: "UNAUTHORIZED", message: "Expired", ok: false }, 401);
    if (call.path === "/auth/refresh") return jsonResponse({ accessToken: "fresh-checkout-token" });
    if (call.path === "/checkout/protected") return jsonResponse({ ok: true });
    throw new Error(`Unexpected fetch call: ${call.method} ${call.path}`);
  }, "https://checkout.test/api/v1");
  const response = await client.get<{ ok: boolean }>("/checkout/protected");

  if (
    !response.ok
    || calls.map((call) => `${call.method} ${call.path}`).join(",") !== "GET /checkout/protected,POST /auth/refresh,GET /checkout/protected"
    || calls[0]?.authorization !== "Bearer stale-checkout-token"
    || calls[1]?.authorization
    || calls[2]?.authorization !== "Bearer fresh-checkout-token"
    || getAccountAccessToken() !== "fresh-checkout-token"
  ) {
    throw new Error("Checkout API unauthorized retry or bearer handling failed.");
  }

  const controlled = new FetchCheckoutApiClient(async () => jsonResponse({
    code: "PRICE_CHANGED",
    issues: [{ code: "CONFLICT", field: "quoteId", message: "The quote changed." }],
    message: "The checkout quote changed.",
    ok: false,
  }, 409), "https://checkout.test/api/v1");
  try {
    await controlled.post("/checkout/complete", {});
    throw new Error("Expected controlled checkout API error.");
  } catch (error) {
    if (!(error instanceof CheckoutApiError) || error.code !== "PRICE_CHANGED" || error.status !== 409 || error.issues[0]?.field !== "quoteId") {
      throw error;
    }
  }

  clearAccountAccessToken();
}

async function runApiSourceScenarioInChild(): Promise<void> {
  const tsxCli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const harness = resolve(process.cwd(), "src/lib/api/checkout/checkout-adapter.harness.ts");
  const { stdout } = await execFileAsync(process.execPath, [tsxCli, harness, "--api-source"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_CHECKOUT_DATA_SOURCE: "api",
      NEXT_PUBLIC_DATA_SOURCE: "mock",
    },
    maxBuffer: 1_048_576,
  });
  if (!stdout.includes("checkout API source scenario passed")) throw new Error("Checkout API source scenario did not complete.");
}

async function runApiSourceScenario(): Promise<void> {
  const { DATA_SOURCE, getCheckoutDataSource } = await import("@/lib/api/config");
  const { getCheckoutRepository } = await import("./checkout.repository");

  if (getCheckoutDataSource() !== DATA_SOURCE.API || getCheckoutRepository().source !== DATA_SOURCE.API) {
    throw new Error("Checkout API source did not require explicit opt-in.");
  }
  console.log("checkout API source scenario passed");
}

function createClient(
  calls: ClientCall[],
  responder: (call: ClientCall) => unknown,
): CheckoutApiClient {
  const invoke = <T>(call: ClientCall): Promise<T> => {
    calls.push(call);
    return Promise.resolve(responder(call) as T);
  };

  return {
    delete: <T>(path: string, options: CheckoutApiMethodOptions = {}) => invoke<T>({ method: "delete", options, path }),
    get: <T>(path: string, options: CheckoutApiMethodOptions = {}) => invoke<T>({ method: API_METHOD.GET, options, path }),
    post: <T>(path: string, body?: unknown, options: CheckoutApiMethodOptions = {}) => invoke<T>({ body, method: API_METHOD.POST, options, path }),
    put: <T>(path: string, body?: unknown, options: CheckoutApiMethodOptions = {}) => invoke<T>({ body, method: "put", options, path }),
    request: <T>(path: string, options: CheckoutApiRequestOptions = {}) => invoke<T>({ body: options.body, method: API_METHOD.REQUEST, options, path }),
  };
}

function rawQuoteResponse(): Record<string, unknown> {
  return {
    currency: "ARS",
    discount: "0.00",
    expiresAt: "2026-08-31T23:00:00.000Z",
    items: [{
      availableQuantity: null,
      lineSubtotal: "42.50",
      productId: "server-product",
      productName: "Server Product",
      quantity: 1,
      sku: "SERVER-001",
      unitPrice: "42.50",
      variantId: "server-variant",
      variantName: "Default",
      weightGrams: null,
    }],
    paymentMethods: [{
      acceptedMethods: ["Transferencia bancaria"],
      bankConfig: {
        alias: "ENTRENAR.API",
        bankName: "Banco API",
        cbuCvu: "0000000000000000000000",
        cuitCuil: "20-00000000-0",
        holderName: "EntrenAR API",
      },
      description: "Bank transfer",
      id: "bank-transfer",
      logoSrc: "/transfer.svg",
      name: "Transferencia Bancaria",
      options: [{ fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" }],
      selectedOptionId: "direct-transfer",
    }],
    pickupPoints: [],
    quoteId: "server-quote-token",
    sessionToken: "guest-session-token",
    shipping: "0.00",
    shippingOptions: [],
    subtotal: "42.50",
    total: "42.50",
    warnings: [],
    ok: true,
  };
}

function rawCompleteResponse(): Record<string, unknown> {
  return {
    currency: "ARS",
    number: "EN-API-001",
    ok: true,
    order: {
      currency: "ARS",
      id: "server-order",
      number: "EN-API-001",
      status: "pending",
      total: "42.50",
    },
    orderId: "server-order",
    status: "pending",
    total: "42.50",
  };
}

function addressInput(): CheckoutCompleteInput["address"] {
  return {
    city: "Buenos Aires",
    number: "123",
    postalCode: "C1000",
    province: "Buenos Aires",
    street: "Test Street",
  };
}

function fetchCall(input: RequestInfo | URL, init?: RequestInit): FetchCall {
  const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return {
    authorization: new Headers(init?.headers).get("authorization"),
    method: init?.method ?? "GET",
    path: new URL(inputUrl).pathname.replace(/^\/api\/v1/, ""),
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ClientCall {
  body?: unknown;
  method: string;
  options?: CheckoutApiMethodOptions | CheckoutApiRequestOptions;
  path: string;
}

interface FetchCall {
  authorization: string | null;
  method: string;
  path: string;
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
