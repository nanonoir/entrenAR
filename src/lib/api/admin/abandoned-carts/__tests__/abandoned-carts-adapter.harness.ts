import { clearAccountAccessToken, setAccountAccessToken } from "@/lib/api/account/access-token";

import { ApiAbandonedCartsRepository } from "../api-abandoned-carts-repository";
import { AbandonedCartsApiError, FetchAbandonedCartsApiClient } from "../client";
import { MockAbandonedCartsRepository } from "../mock-abandoned-carts-repository";
import type { AbandonedCartListItem, RecoveryActionResult } from "../types";

async function run(): Promise<void> {
  await runMockScenario();
  await runApiScenario();
  await runValidationScenario();
  await runFallbackScenario();
  console.log("abandoned-carts adapter harness: mock parity, authenticated API, validation, and offline/5xx fallback passed");
}

async function runMockScenario(): Promise<void> {
  const repository = new MockAbandonedCartsRepository();
  const page = await repository.list({ search: " lucía ", limit: 1 });
  assert(page.items[0]?.id === "CART-901" && page.total === 1 && page.summary.pendingCount === 1, "Mock filtering or pagination failed.");
  const detail = await repository.getById("CART-901");
  assert(detail.cartId === "cart-CART-901" && detail.items.length === 2 && detail.timeline.length >= 2, "Mock detail or timeline failed.");

  const email = await repository.sendRecoveryEmail("CART-901", "Follow up by email.");
  assert(email.cart.recoveryStatus === "SENT" && email.recoveryLink?.url.includes("recoveryToken=") === true, "Mock recovery email failed.");
  const manual = await new MockAbandonedCartsRepository().markManualRecovery("CART-901", "Called customer.");
  assert(manual.cart.recoveryStatus === "MANUAL", "Mock manual recovery failed.");
  const converted = await new MockAbandonedCartsRepository().convertCart("CART-901");
  assert(converted.cart.recoveryStatus === "RECOVERED" && converted.orderId, "Mock conversion failed.");
  const discarded = await new MockAbandonedCartsRepository().discardCart("CART-901", "Customer declined recovery.");
  assert(discarded.cart.recoveryStatus === "DISCARDED", "Mock discard failed.");

  const config = await repository.updateConfig({ timing: "6hs" });
  const template = await repository.updateTemplate({ subject: "Updated subject" });
  assert(config.timing === "6hs" && template.subject === "Updated subject", "Mock config or template update failed.");
}

async function runApiScenario(): Promise<void> {
  const calls: FetchCall[] = [];
  const client = new FetchAbandonedCartsApiClient(async (input, init) => {
    const call = toFetchCall(input, init);
    calls.push(call);
    if (call.method === "GET" && call.path.startsWith("/admin/abandoned-carts?")) return jsonResponse(rawList());
    if (call.method === "GET" && call.path === "/admin/abandoned-carts/api-cart") return jsonResponse(rawDetail());
    if (call.method === "GET" && call.path === "/admin/abandoned-carts/config") return jsonResponse({ isActive: true, timing: "24hs" });
    if (call.method === "GET" && call.path === "/admin/abandoned-carts/template") return jsonResponse(rawTemplate());
    if (call.method === "PUT" && call.path === "/admin/abandoned-carts/config") return jsonResponse({ isActive: false, timing: "6hs" });
    if (call.method === "PUT" && call.path === "/admin/abandoned-carts/template") return jsonResponse({ ...rawTemplate(), subject: "Saved subject" });
    if (call.method === "POST" && call.path.endsWith("/email")) return jsonResponse(rawAction({ recoveryStatus: "SENT" }, true));
    if (call.method === "POST" && call.path.endsWith("/manual")) return jsonResponse(rawAction({ recoveryStatus: "MANUAL" }, false));
    if (call.method === "POST" && call.path.endsWith("/convert")) return jsonResponse(rawAction({ recoveryStatus: "RECOVERED" }, false, "order-1"));
    if (call.method === "POST" && call.path.endsWith("/discard")) return jsonResponse(rawAction({ recoveryStatus: "DISCARDED" }, false));
    throw new Error(`Unexpected API call: ${call.method} ${call.path}`);
  }, "https://abandoned-carts.test/api/v1");

  setAccountAccessToken("harness-token");
  const repository = new ApiAbandonedCartsRepository(client, new MockAbandonedCartsRepository(), false);
  const page = await repository.list({ limit: 2, status: "PENDING" });
  const detail = await repository.getById("api-cart");
  const email = await repository.sendRecoveryEmail("api-cart", "API note");
  const manual = await repository.markManualRecovery("api-cart", "API manual note");
  const converted = await repository.convertCart("api-cart");
  const discarded = await repository.discardCart("api-cart", "API discard reason");
  const config = await repository.updateConfig({ timing: "6hs" });
  const template = await repository.updateTemplate({ subject: "Saved subject" });
  assert(page.items[0]?.id === "api-cart" && detail.timeline[0]?.eventType === "SESSION_CREATED", "API list or detail mapping failed.");
  assert(email.cart.recoveryStatus === "SENT" && email.recoveryLink?.url.includes("recoveryToken=") === true, "API email mapping failed.");
  assert(manual.cart.recoveryStatus === "MANUAL" && converted.orderId === "order-1" && discarded.cart.recoveryStatus === "DISCARDED", "API action mapping failed.");
  assert(config.timing === "6hs" && template.subject === "Saved subject", "API config or template mapping failed.");
  assert(calls.every((call) => call.authorization === "Bearer harness-token"), "API client did not authenticate every request.");
  clearAccountAccessToken();
}

async function runValidationScenario(): Promise<void> {
  const calls: FetchCall[] = [];
  const client = new FetchAbandonedCartsApiClient(async (input, init) => { calls.push(toFetchCall(input, init)); return jsonResponse(rawList()); }, "https://validation.test/api/v1");
  try {
    await new ApiAbandonedCartsRepository(client, new MockAbandonedCartsRepository(), false).list({ limit: 0 });
    throw new Error("Expected invalid query to fail.");
  } catch (error) {
    assert(error instanceof AbandonedCartsApiError && error.code === "VALIDATION_ERROR" && error.status === 400 && calls.length === 0, "Invalid query was not controlled before fetch.");
  }

  const apiErrorClient = new FetchAbandonedCartsApiClient(async () => jsonResponse({ code: "VALIDATION_ERROR", issues: [{ code: "custom", field: "status", message: "Invalid status." }], message: "The query is invalid.", ok: false }, 400), "https://validation.test/api/v1");
  try {
    await new ApiAbandonedCartsRepository(apiErrorClient, new MockAbandonedCartsRepository(), false).getById("api-cart");
    throw new Error("Expected API validation error to fail.");
  } catch (error) {
    assert(error instanceof AbandonedCartsApiError && error.code === "VALIDATION_ERROR" && error.status === 400 && error.issues[0]?.field === "status", "API validation error was not normalized.");
  }
}

async function runFallbackScenario(): Promise<void> {
  const offline = new FetchAbandonedCartsApiClient(async () => { throw new Error("offline"); }, "https://offline.test/api/v1");
  const fallback = new ApiAbandonedCartsRepository(offline, new MockAbandonedCartsRepository(), true);
  assert((await fallback.list({ search: "Lucía" })).items[0]?.id === "CART-901", "Offline fallback did not use mocks.");
  const serverError = new FetchAbandonedCartsApiClient(async () => jsonResponse({ code: "INTERNAL_ERROR", message: "Server unavailable.", ok: false }, 500), "https://server-error.test/api/v1");
  const serverFallback = new ApiAbandonedCartsRepository(serverError, new MockAbandonedCartsRepository(), true);
  assert((await serverFallback.list()).total === 4, "5xx fallback did not use mocks.");
}

function rawList() {
  return { items: [rawListItem()], limit: 2, page: 1, summary: { pendingCount: 1, recoverableTotal: 87800, recoveredCount: 0 }, total: 1, totalPages: 1 };
}

function rawListItem(overrides: Record<string, unknown> = {}): AbandonedCartListItem {
  return { abandonedAt: "2026-06-12T10:15:00.000Z", customer: { email: "api@example.com", firstName: "API", lastName: "Customer" }, id: "api-cart", products: [{ lineSubtotal: 100, name: "API Product", productId: "p-api", quantity: 1, unitPrice: 100 }], recoveryStatus: "PENDING", total: 100, ...overrides };
}

function rawDetail() {
  return { ...rawListItem(), cartId: "cart-api", items: rawListItem().products, timeline: [{ createdAt: "2026-06-12T10:15:00.000Z", eventType: "SESSION_CREATED", id: "history-1" }] };
}

function rawAction(overrides: Record<string, unknown>, includeLink: boolean, orderId?: string): RecoveryActionResult {
  return { cart: rawListItem(overrides), ...(orderId ? { orderId } : {}), recoveryLink: includeLink ? { expiresAt: "2026-06-19T10:15:00.000Z", isExpired: false, url: "/checkout?recoveryToken=token" } : null };
}

function rawTemplate() { return { htmlBody: "<p>{{nombre}}</p>", plainTextBody: "{{nombre}}", subject: "Recovery" }; }
function toFetchCall(input: RequestInfo | URL, init?: RequestInit): FetchCall { const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url; const url = new URL(value); return { authorization: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET", path: `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}` }; }
function jsonResponse(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status }); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
interface FetchCall { authorization: string | null; method: string; path: string; }
void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
