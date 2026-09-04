import { CustomersApiError } from "../client";
import { MockCustomersRepository } from "../mock-customers.repository";
import type { CustomersRepository } from "../repository";
import type { CustomerFormValues } from "@/schemas/admin/customer-schema";
import { createAdminCustomersStore } from "@/stores/admin-customers-store";

async function run(): Promise<void> {
  await runDelegationScenario(); await runRollbackScenario(); await runFallbackScenario();
  console.log("customers store harness: hydration, optimistic mutations, email checks, rollback, fallback, retry, and mock parity passed");
}

async function runDelegationScenario(): Promise<void> {
  const calls: string[] = [], backingRepository = new MockCustomersRepository();
  const repository = asApiRepository(backingRepository, calls);
  const store = createAdminCustomersStore({ repository, fallbackRepository: new MockCustomersRepository() });
  assert(store.getState().dataSource === "api", "The injected API repository was not selected.");
  await store.getState().fetchCustomers({ limit: 100 });
  assert(store.getState().hasLoaded && calls.includes("list"), "Customer hydration did not call the repository.");
  assert(!store.getState().isEmailAvailable("CAMILA.PEREZ@EXAMPLE.COM"), "Local email availability ignored active customers.");
  assert(store.getState().isEmailAvailable("new-customer@example.com"), "Local email availability rejected a free email."); await flush();
  assert(calls.includes("isEmailAvailable"), "Email availability did not delegate its asynchronous check.");
  const created = store.getState().createCustomer(formInput());
  assert(created.ok && store.getState().customers.some((customer) => customer.id === created.customerId), "Customer creation was not optimistic."); await flush();
  assert(calls.includes("create"), "Customer creation did not synchronize with the repository.");
  const updated = store.getState().updateCustomer(created.customerId, { ...formInput(), fullName: "Updated Harness Customer" });
  assert(updated.ok && store.getState().customers.find((customer) => customer.id === created.customerId)?.fullName === "Updated Harness Customer", "Customer update was not optimistic."); await flush();
  assert(calls.includes("update"), "Customer update did not synchronize with the repository.");
  store.getState().updateCustomerNotes(created.customerId, "Follow up"); assert(store.getState().customers.find((customer) => customer.id === created.customerId)?.notes === "Follow up", "Customer notes were not optimistic."); await flush();
  assert(calls.includes("updateNotes"), "Customer notes did not synchronize with the repository.");
  store.getState().anonymizeCustomer(created.customerId); assert(store.getState().customers.find((customer) => customer.id === created.customerId)?.isAnonymized, "Customer anonymization was not optimistic."); await flush();
  assert(calls.includes("anonymize") && store.getState().customers.find((customer) => customer.id === created.customerId)?.email === "", "Customer anonymization did not synchronize.");
}

async function runRollbackScenario(): Promise<void> {
  const repository = asApiRepository(new MockCustomersRepository(), [], { update: async () => { throw new CustomersApiError({ code: "CONFLICT", message: "Customer update rejected.", status: 409 }); } });
  const store = createAdminCustomersStore({ repository, fallbackRepository: new MockCustomersRepository() }); await store.getState().fetchCustomers({ limit: 100 });
  const previousName = store.getState().customers.find((customer) => customer.id === "cus_001")?.fullName;
  const result = store.getState().updateCustomer("cus_001", { ...formInput(), fullName: "Temporary Name" });
  assert(result.ok && store.getState().customers.find((customer) => customer.id === "cus_001")?.fullName === "Temporary Name", "Rollback scenario did not start optimistically."); await flush();
  assert(store.getState().customers.find((customer) => customer.id === "cus_001")?.fullName === previousName && store.getState().error === "Customer update rejected.", "Failed customer update did not roll back with its controlled error.");
}

async function runFallbackScenario(): Promise<void> {
  let available = false; const backingRepository = new MockCustomersRepository();
  const repository = asApiRepository(backingRepository, [], { list: async (...args: unknown[]) => { if (!available) throw new CustomersApiError({ code: "CUSTOMERS_API_UNAVAILABLE", message: "Offline.", status: 503 }); return backingRepository.list(...(args as [Parameters<MockCustomersRepository["list"]>[0]])); } });
  const store = createAdminCustomersStore({ repository, fallbackRepository: new MockCustomersRepository() }); await store.getState().fetchCustomers({ limit: 100 });
  assert(store.getState().isFallback && store.getState().dataSource === "mock", "Unavailable API did not activate the mock fallback."); available = true; await store.getState().retryLoad();
  assert(!store.getState().isFallback && store.getState().dataSource === "api", "Retry did not restore the configured API repository.");
}

function formInput(): CustomerFormValues { return { city: "Buenos Aires", country: "Argentina", dniOrCuil: "30123456", email: "harness-store@example.com", floorOrApartment: "", fullName: "Harness Store Customer", neighborhood: "", number: "10", phone: "+54 11 5555-0000", postalCode: "1000", provinceOrState: "Buenos Aires", street: "Harness Street" }; }

function asApiRepository(target: MockCustomersRepository, calls: string[], overrides: Record<string, (...args: unknown[]) => unknown> = {}): CustomersRepository {
  return new Proxy(target, { get(repository, property) { const name = String(property); if (name === "source") return "api"; const override = overrides[name]; if (override) return (...args: unknown[]) => { calls.push(name); return override(...args); }; const value = Reflect.get(repository, property); return typeof value === "function" ? (...args: unknown[]) => { calls.push(name); return value.apply(repository, args); } : value; } }) as unknown as CustomersRepository;
}

function flush(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 0)); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
