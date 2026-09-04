import { ApiCustomersRepository } from "../api-customers.repository";
import { CustomersApiError, FetchCustomersApiClient } from "../client";
import { MockCustomersRepository } from "../mock-customers.repository";
import type { CreateCustomerInput } from "../types";
import { clearAccountAccessToken, setAccountAccessToken } from "@/lib/api/account/access-token";

async function run(): Promise<void> {
  await runMockScenario();
  await runApiScenario();
  await runFallbackAndErrorScenarios();
  console.log("customers adapter harness: mock parity, authenticated API, fallback, and controlled errors passed");
}

async function runMockScenario(): Promise<void> {
  const repository = new MockCustomersRepository();
  const page = await repository.list({ search: " CAMILA ", limit: 1 });
  assert(page.items[0]?.id === "cus_001" && page.total === 1, "Mock customer search or pagination failed.");

  const created = await repository.create(formInput());
  assert(created.ok && created.customerId === "cus_008" && created.customer.tags.length === 1, "Mock customer creation failed.");
  const withoutAddress = await repository.create({ email: "no-address@example.com", fullName: "No Address", country: "Argentina" });
  assert(withoutAddress.ok && !withoutAddress.customer.address, "Optional form address handling failed.");
  const duplicate = await repository.create({ ...formInput(), email: "CAMILA.PEREZ@EXAMPLE.COM" });
  assert(!duplicate.ok && duplicate.code === "EMAIL_EXISTS", "Mock active-email uniqueness failed.");
  const notes = await repository.updateNotes(created.customerId, "Follow up");
  assert(notes.ok && notes.customer.notes === "Follow up", "Mock notes update failed.");
  const anonymized = await repository.anonymize(created.customerId);
  assert(anonymized.ok && anonymized.customer.isAnonymized && anonymized.customer.email === "", "Mock anonymization failed.");
  const csv = await repository.exportCsv({ isAnonymized: true });
  assert(csv.startsWith("\uFEFF") && csv.includes(`Cliente eliminado (${created.customerId})`), "Mock CSV privacy or BOM failed.");
  try {
    await repository.exportCustomerDetailCsv(created.customerId);
    throw new Error("Expected anonymized detail export to fail.");
  } catch (error) {
    assert(error instanceof CustomersApiError && error.code === "CUSTOMER_ANONYMIZED", "Mock detail export error was not controlled.");
  }
  assert((await new MockCustomersRepository().list()).total === 7, "Mock repository leaked mutation state into its fixtures.");
}

async function runApiScenario(): Promise<void> {
  const calls: FetchCall[] = [];
  const client = new FetchCustomersApiClient(async (input, init) => {
    const call = toFetchCall(input, init);
    calls.push(call);
    if (call.path.startsWith("/admin/customers/export")) return csvResponse("\uFEFFID;Nombre y apellido");
    if (call.path.endsWith("/export")) return csvResponse("\uFEFFCampo;Valor");
    if (call.path.startsWith("/admin/customers/availability")) return jsonResponse({ available: true });
    if (call.path === "/admin/customers?city=Buenos+Aires&limit=5&page=1&sortBy=createdAt&sortOrder=desc") return jsonResponse({ items: [rawCustomer()], limit: 5, page: 1, total: 1, totalPages: 1 });
    if (call.method === "GET" && call.path === "/admin/customers/api-customer") return jsonResponse(rawDetail());
    if (call.path === "/admin/customers/api-customer") return jsonResponse(rawCustomer());
    if (call.path === "/admin/customers") return jsonResponse(rawCustomer());
    if (call.path.startsWith("/admin/customers/api-customer/")) return jsonResponse(rawCustomer());
    throw new Error(`Unexpected API call: ${call.method} ${call.path}`);
  }, "https://customers.test/api/v1");

  setAccountAccessToken("harness-token");
  const repository = new ApiCustomersRepository(client, new MockCustomersRepository(), false);
  const page = await repository.list({ city: "Buenos Aires", limit: 5 });
  const detail = await repository.getById("api-customer");
  const created = await repository.create(formInput());
  await repository.update("api-customer", { fullName: "Updated Customer" });
  await repository.updateNotes("api-customer", "API note");
  await repository.anonymize("api-customer");
  assert(page.items[0]?.tags[0] === "vip" && detail.summary.totalSpent === 1250 && created.ok, "API response mapping failed.");
  const exported = await repository.exportCsv();
  const available = await repository.isEmailAvailable("new@example.com");
  assert(exported.startsWith("\uFEFF") && available, "API export or availability failed.");
  assert(calls.some((call) => call.authorization === "Bearer harness-token"), "API client did not send the auth token.");
  clearAccountAccessToken();
}

async function runFallbackAndErrorScenarios(): Promise<void> {
  const unavailable = new FetchCustomersApiClient(async () => { throw new Error("offline"); }, "https://customers.test/api/v1");
  const fallback = new ApiCustomersRepository(unavailable, new MockCustomersRepository(), true);
  assert((await fallback.list({ search: "Camila" })).items[0]?.id === "cus_001", "Network fallback did not use the mock repository.");

  const business = new FetchCustomersApiClient(async () => jsonResponse({ code: "EMAIL_EXISTS", message: "Email already exists.", ok: false }, 409), "https://customers.test/api/v1");
  try {
    await new ApiCustomersRepository(business, new MockCustomersRepository(), false).create(formInput());
    throw new Error("Expected business API error to fail.");
  } catch (error) {
    assert(error instanceof CustomersApiError && error.ok === false && error.code === "EMAIL_EXISTS" && error.status === 409, "Business API error mapping failed.");
  }

  const invalid = new FetchCustomersApiClient(async () => jsonResponse({ items: [] }), "https://customers.test/api/v1");
  try {
    await new ApiCustomersRepository(invalid, new MockCustomersRepository(), false).list();
    throw new Error("Expected invalid API response to fail.");
  } catch (error) {
    assert(error instanceof CustomersApiError && error.code === "CUSTOMERS_API_INVALID_RESPONSE", "Invalid API response was not controlled.");
  }
}

function formInput(): CreateCustomerInput {
  return { city: "Buenos Aires", country: "Argentina", email: "harness@example.com", fullName: "Harness Customer", tags: ["harness"], number: "10", postalCode: "1000", provinceOrState: "Buenos Aires", street: "Harness Street" };
}

function rawCustomer(id = "api-customer") {
  return { createdAt: "2026-09-04T10:00:00.000Z", email: "api@example.com", firstInteractionDate: "2026-09-04T10:00:00.000Z", fullName: "API Customer", id, isAnonymized: false, tags: ["vip"], updatedAt: "2026-09-04T10:00:00.000Z" };
}

function rawDetail() {
  return { ...rawCustomer(), address: { city: "Buenos Aires", country: "Argentina", number: "10", postalCode: "1000", provinceOrState: "Buenos Aires", street: "API Street" }, summary: { lastOrder: { date: "2026-09-03T10:00:00.000Z", id: "order-1", number: "EN-001", total: 1250 }, ordersCount: 1, totalSpent: 1250 } };
}

function toFetchCall(input: RequestInfo | URL, init?: RequestInit): FetchCall {
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(value);
  return { authorization: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET", path: `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}` };
}

function jsonResponse(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status }); }
function csvResponse(value: string): Response { return new Response(value, { headers: { "content-type": "text/csv; charset=utf-8" }, status: 200 }); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
interface FetchCall { authorization: string | null; method: string; path: string; }

void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
