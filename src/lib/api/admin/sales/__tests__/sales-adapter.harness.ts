import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  clearAccountAccessToken,
  getAccountAccessToken,
  setAccountAccessToken,
} from "@/lib/api/account/client";
import {
  FetchSalesApiClient,
  SalesApiError,
  type SalesApiClient,
  type SalesApiMethodOptions,
  type SalesApiRequestOptions,
} from "../client";
import { ApiSalesRepository } from "../api-sales.repository";
import { MockSalesRepository } from "../mock-sales.repository";
import {
  mapAdminSaleDetail,
  mapPurchaseOrderResponse,
} from "../sales-api.mappers";
import {
  toCreateManualSalePayload,
  toSalesQueryParams,
} from "../sales-api.payloads";
import type {
  CreateManualSalePayload,
  CreatePurchaseOrderPayload,
  CreateSupplierPayload,
} from "../sales.repository";

const execFileAsync = promisify(execFile);

async function run(): Promise<void> {
  if (process.argv.includes("--source")) {
    await runSourceScenario();
    return;
  }

  await runMockScenario();
  await runApiScenario();
  await runSchemaScenario();
  await runClientScenario();
  await runConfigurationScenario();
  console.log("sales adapter harness: mock/API parity, Zod contracts, controlled errors, auth client, and source toggle passed");
}

async function runMockScenario(): Promise<void> {
  const repository = new MockSalesRepository();
  const page = await repository.getSales({ isArchived: false, limit: 10 });
  assert(page.items.length === 3, "Mock sales listing did not preserve the active fixtures.");
  assert((await repository.getSaleById("101")).id === "101", "Mock sale detail lookup failed.");

  const created = await repository.createManualSale(manualSalePayload());
  assert(created.paymentStatus === "received" && created.products[0]?.name === "Harness Product", "Mock manual-sale mapping failed.");

  const supplier = await repository.createSupplier(supplierPayload());
  assert(supplier.status === "active" && supplier.code === "HARNESS-001", "Mock supplier creation failed.");
  assert((await repository.toggleSupplierStatus(supplier.id)).status === "inactive", "Mock supplier status toggle failed.");

  const purchaseOrder = await repository.createPurchaseOrder(purchaseOrderPayload());
  await repository.submitPurchaseOrder(purchaseOrder.id);
  const received = await repository.receivePurchaseOrder(purchaseOrder.id);
  assert(received.status === "converted" && received.backendStatus === "RECEIVED", "Mock purchase-order lifecycle failed.");
}

async function runApiScenario(): Promise<void> {
  const calls: ClientCall[] = [];
  const repository = new ApiSalesRepository(createClient(calls, responseFor));
  const page = await repository.getSales({ limit: 5, page: 2, status: "confirmed" });
  assert(page.items[0]?.total === 125, "API sales summary mapping failed.");

  const detail = await repository.getSaleById("sale-api");
  assert(detail.items[0]?.name === "API Product" && detail.status === "confirmed", "API sale detail mapping failed.");
  await repository.createManualSale(manualSalePayload());
  await repository.convertOrderToSale({ sourceOrderId: "order-api" });
  await repository.confirmSale("sale-api");
  await repository.packSale("sale-api");
  await repository.unpackSale("sale-api");
  await repository.shipSale("sale-api", { carrier: "Carrier", trackingCode: "TRACK-1" });
  await repository.deliverSale("sale-api");
  await repository.cancelSale("sale-api", { cancellationReason: "Harness", restoreStock: false });
  await repository.reopenSale("sale-api");
  await repository.archiveSale("sale-api");
  await repository.unarchiveSale("sale-api");
  await repository.addNote("sale-api", "Harness note");

  const suppliers = await repository.getSuppliers();
  assert(suppliers[0]?.status === "active", "API supplier list mapping failed.");
  await repository.createSupplier(supplierPayload());
  await repository.updateSupplier("supplier-api", { name: "Updated Supplier" });
  const toggled = await repository.toggleSupplierStatus("supplier-api");
  assert(toggled.status === "inactive", "API supplier status mapping failed.");

  const orders = await repository.getPurchaseOrders();
  assert(orders[0]?.supplier?.code === "API-001", "API purchase-order list mapping failed.");
  await repository.getPurchaseOrderById("po-api");
  await repository.createPurchaseOrder(purchaseOrderPayload());
  await repository.submitPurchaseOrder("po-api");
  await repository.receivePurchaseOrder("po-api");
  await repository.cancelPurchaseOrder("po-api");

  const paths = calls.map((call) => call.path).join("\n");
  for (const expected of [
    "/admin/sales/convert-order",
    "/admin/sales/sale-api/confirm",
    "/admin/sales/sale-api/notes",
    "/admin/suppliers/supplier-api/status",
    "/admin/purchase-orders/po-api/receive",
  ]) {
    assert(paths.includes(expected), `API repository did not call ${expected}.`);
  }

  const createCall = calls.find((call) => call.method === "POST" && call.path === "/admin/sales");
  assert(isRecord(createCall?.body) && createCall.body.paymentStatus === "PAID", "Manual sale payload was not normalized for the API.");
}

async function runSchemaScenario(): Promise<void> {
  const detail = mapAdminSaleDetail({ ok: true, data: rawSaleDetail() });
  assert(detail.customerSnapshot.email === "api@example.com", "Envelope response unwrapping failed.");

  try {
    mapAdminSaleDetail({ id: "malformed" });
    throw new Error("Expected malformed sale response to fail.");
  } catch (error) {
    assert(error instanceof SalesApiError && error.code === "SALES_API_INVALID_RESPONSE" && error.status === 502, "Malformed response was not controlled.");
  }

  try {
    toCreateManualSalePayload({ ...manualSalePayload(), products: [] });
    throw new Error("Expected malformed manual sale payload to fail.");
  } catch (error) {
    assert(error instanceof SalesApiError && error.code === "VALIDATION_ERROR" && error.status === 400, "Zod request validation was not controlled.");
  }

  try {
    toSalesQueryParams({ dateRange: { from: "2026-09-04", to: "2026-09-03" } });
    throw new Error("Expected an invalid date range to fail.");
  } catch (error) {
    assert(error instanceof SalesApiError && error.code === "VALIDATION_ERROR", "Invalid sales date range was not controlled.");
  }

  const purchaseOrder = mapPurchaseOrderResponse({ ok: true, data: rawPurchaseOrder() });
  assert(purchaseOrder.backendStatus === "ORDERED" && purchaseOrder.products[0]?.unitPrice === 25, "Purchase-order response schema mapping failed.");
}

async function runClientScenario(): Promise<void> {
  const calls: FetchCall[] = [];
  let protectedAttempts = 0;
  setAccountAccessToken("stale-token");
  const client = new FetchSalesApiClient(async (input, init) => {
    const call = fetchCall(input, init);
    calls.push(call);
    if (call.path === "/protected" && protectedAttempts++ === 0) return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Expired" }, 401);
    if (call.path === "/auth/refresh") return jsonResponse({ accessToken: "fresh-token" });
    if (call.path === "/protected") return jsonResponse({ ok: true });
    throw new Error(`Unexpected fetch call: ${call.method} ${call.path}`);
  }, "https://sales.test/api/v1");
  const response = await client.get<{ ok: boolean }>("/protected");
  assert(response.ok && getAccountAccessToken() === "fresh-token", "Authenticated sales client refresh failed.");
  assert(calls.map((call) => `${call.method} ${call.path}`).join(",") === "GET /protected,POST /auth/refresh,GET /protected", "Sales client retry sequence failed.");

  const validation = new FetchSalesApiClient(async () => jsonResponse({
    code: "CONFLICT",
    issues: [{ code: "DUPLICATE", field: "code", message: "Already exists." }],
    message: "Already exists.",
    ok: false,
  }, 409), "https://sales.test/api/v1");
  try {
    await validation.get("/admin/suppliers");
    throw new Error("Expected HTTP error to fail.");
  } catch (error) {
    assert(error instanceof SalesApiError && error.code === "CONFLICT" && error.issues[0]?.field === "code", "HTTP error mapping failed.");
  }

  const unavailable = new FetchSalesApiClient(async () => { throw new Error("offline"); }, "https://sales.test/api/v1");
  try {
    await unavailable.get("/admin/sales");
    throw new Error("Expected unavailable error to fail.");
  } catch (error) {
    assert(error instanceof SalesApiError && error.code === "SALES_API_UNAVAILABLE" && error.status === 503, "Network error mapping failed.");
  }
  clearAccountAccessToken();
}

async function runConfigurationScenario(): Promise<void> {
  const mock = await runHarnessChild(["--source", "mock"], {
    ...process.env,
    NEXT_PUBLIC_USE_MOCK_ADMIN_SALES: "true",
    NEXT_PUBLIC_DATA_SOURCE: "api",
  });
  assert(mock.stdout.includes("sales source mock scenario passed"), "Mock admin-sales source selection failed.");

  const api = await runHarnessChild(["--source", "api"], {
    ...process.env,
    NEXT_PUBLIC_USE_MOCK_ADMIN_SALES: "false",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
  });
  assert(api.stdout.includes("sales source api scenario passed"), "API admin-sales source selection failed.");
}

async function runSourceScenario(): Promise<void> {
  const expected = process.argv.includes("mock") ? "mock" : "api";
  const { DATA_SOURCE, getAdminSalesDataSource, salesRepository } = await import("@/lib/api/config");
  const source = getAdminSalesDataSource();
  assert(source === (expected === "mock" ? DATA_SOURCE.MOCK : DATA_SOURCE.API), `Expected admin-sales source ${expected}, received ${source}.`);
  assert(salesRepository.source === source, "Configured sales repository does not match its source.");
  console.log(`sales source ${expected} scenario passed`);
}

function responseFor(call: ClientCall): unknown {
  if (call.method === "GET" && call.path.startsWith("/admin/sales?")) return { items: [rawSaleSummary()], limit: 5, page: 2, total: 1 };
  if (call.method === "GET" && call.path === "/admin/sales/sale-api") return rawSaleDetail();
  if (call.path.startsWith("/admin/suppliers")) return call.method === "GET" && (call.path === "/admin/suppliers" || call.path.startsWith("/admin/suppliers?"))
    ? { items: [rawSupplier()], limit: 20, page: 1, total: 1 }
    : rawSupplier({ status: call.method === "PATCH" ? "INACTIVE" : "ACTIVE" });
  if (call.path.startsWith("/admin/purchase-orders")) return call.method === "GET" && (call.path === "/admin/purchase-orders" || call.path.startsWith("/admin/purchase-orders?"))
    ? { items: [rawPurchaseOrder()], limit: 20, page: 1, total: 1 }
    : rawPurchaseOrder();
  if (call.path === "/admin/sales" || call.path.startsWith("/admin/sales/")) return rawSaleDetail();
  throw new Error(`Unhandled API repository call: ${call.method} ${call.path}`);
}

function createClient(calls: ClientCall[], responder: (call: ClientCall) => unknown): SalesApiClient {
  const invoke = <T>(call: ClientCall): Promise<T> => {
    calls.push(call);
    return Promise.resolve(responder(call) as T);
  };
  return {
    delete: <T>(path: string, options: SalesApiMethodOptions = {}) => invoke<T>({ method: "DELETE", options, path }),
    get: <T>(path: string, options: SalesApiMethodOptions = {}) => invoke<T>({ method: "GET", options, path }),
    patch: <T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}) => invoke<T>({ body, method: "PATCH", options, path }),
    post: <T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}) => invoke<T>({ body, method: "POST", options, path }),
    put: <T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}) => invoke<T>({ body, method: "PUT", options, path }),
    request: <T>(path: string, options: SalesApiRequestOptions = {}) => invoke<T>({ body: options.body, method: options.method ?? "GET", options, path }),
  };
}

function manualSalePayload(): CreateManualSalePayload {
  return {
    customer: { email: "harness@example.com", firstName: "Harness", lastName: "Customer" },
    paymentStatus: "received",
    products: [{ name: "Harness Product", productId: "product-harness", quantity: 1, unitPrice: 100 }],
    shippingCost: 25,
    source: "Harness",
    subtotal: 100,
    total: 125,
  };
}

function supplierPayload(): CreateSupplierPayload {
  return { code: " harness-001 ", email: "supplier@example.com", name: "Harness Supplier", status: "active" };
}

function purchaseOrderPayload(): CreatePurchaseOrderPayload {
  return {
    items: [{ productId: "product-harness", quantity: 2, title: "Harness Product", unitCost: 25 }],
    supplierId: "supplier-nutricion",
  };
}

function rawSaleSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    createdAt: "2026-09-03T10:00:00.000Z",
    currency: "ARS",
    customer: { email: "api@example.com", firstName: "API", lastName: "Customer" },
    deliveryType: "SHIPPING",
    id: "sale-api",
    isArchived: false,
    itemCount: 1,
    number: "EN-API-001",
    paymentStatus: "PAID",
    shippingStatus: "TO_PACK",
    status: "CONFIRMED",
    total: 125,
    trackingCode: "TRACK-API",
    updatedAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

function rawSaleDetail(): Record<string, unknown> {
  return {
    ...rawSaleSummary(),
    confirmedAt: "2026-09-03T10:00:00.000Z",
    customerSnapshot: { email: "api@example.com", firstName: "API", lastName: "Customer" },
    deliverySnapshot: { city: "Buenos Aires", country: "Argentina", number: "10", postalCode: "1000", province: "Buenos Aires", street: "API Street" },
    discountAmount: 0,
    discountSnapshot: {},
    history: [{ actorRole: "ADMIN", createdAt: "2026-09-03T10:00:00.000Z", id: "history-api", title: "Sale created", type: "ORDER_CREATED" }],
    internalNotes: "API note",
    items: [{ attributes: {}, lineSubtotal: 100, productId: "product-api", productName: "API Product", quantity: 1, sku: "API-001", snapshot: {}, unitPrice: 100 }],
    payment: { amount: 125, currency: "ARS", paymentMethodId: "manual", paymentMethodSnapshot: {}, status: "PAID" },
    shippingCost: 25,
    subtotal: 100,
  };
}

function rawSupplier(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "API-001",
    contactName: null,
    createdAt: "2026-09-03T10:00:00.000Z",
    email: "supplier@example.com",
    id: "supplier-api",
    name: "API Supplier",
    notes: null,
    phone: null,
    status: "ACTIVE",
    updatedAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

function rawPurchaseOrder(): Record<string, unknown> {
  return {
    createdAt: "2026-09-03T10:00:00.000Z",
    expectedDate: null,
    id: "po-api",
    items: [{ productId: "product-api", quantity: 2, sku: "API-001", title: "API Product", totalCost: 50, unitCost: 25, variantId: null }],
    notes: null,
    orderNumber: "PO-API-001",
    receivedAt: null,
    shippingCost: 0,
    status: "ORDERED",
    subtotal: 50,
    supplier: rawSupplier(),
    supplierId: "supplier-api",
    tax: 0,
    total: 50,
    updatedAt: "2026-09-03T10:00:00.000Z",
  };
}

async function runHarnessChild(args: string[], env: NodeJS.ProcessEnv) {
  const tsxCli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const harness = resolve(process.cwd(), "src/lib/api/admin/sales/__tests__/sales-adapter.harness.ts");
  return execFileAsync(process.execPath, [tsxCli, harness, ...args], { cwd: process.cwd(), env, maxBuffer: 1_048_576 });
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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

interface ClientCall {
  body?: unknown;
  method: string;
  options?: SalesApiMethodOptions | SalesApiRequestOptions;
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
