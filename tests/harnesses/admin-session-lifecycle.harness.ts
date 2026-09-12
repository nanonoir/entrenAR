import { AdminApiClient, invalidateAdminRequests } from "@/lib/api/admin/client";
import { invalidateAdminSession } from "@/lib/api/admin/auth/admin-session-generation";
import { getAdminAccessToken, setAdminAccessToken } from "@/lib/api/admin/auth/admin-access-token";
import { createAdminStatisticsStore } from "@/stores/admin-statistics-store";
import { createAdminCustomersStore } from "@/stores/admin-customers-store";
import { STATISTICS_PERIOD } from "@/lib/api/admin/statistics/types";
import { setAccountAccessToken, getAccountAccessToken } from "@/lib/api/account/access-token";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

async function run(): Promise<void> {
  setAdminAccessToken("admin-token");
  setAccountAccessToken("customer-token");
  const response = deferred<Response>();
  const client = new AdminApiClient(async () => response.promise, "http://api.test");
  const request = client.get("/admin/customers");
  invalidateAdminRequests();
  response.resolve(new Response(JSON.stringify({ id: "stale" }), { status: 200 }));
  await request.catch(() => undefined);
  assert(getAdminAccessToken() === "admin-token", "Reset must not mutate customer/admin token unexpectedly in the adapter harness.");

  const report = deferred<ReturnType<typeof Promise.resolve>>();
  const store = createAdminStatisticsStore({ repository: {
    source: "api",
    getOverview: () => report.promise as never,
    getSales: async () => ({} as never), getProducts: async () => ({} as never), getCustomers: async () => ({} as never), getCoupons: async () => ({} as never),
  } });
  const loading = store.getState().fetchOverview();
  invalidateAdminSession();
  report.resolve({} as never);
  await loading;
  assert(store.getState().overview.data === null, "Late statistics responses must not repopulate state after reset.");
  const customers = deferred<never>();
  const customerStore = createAdminCustomersStore({ repository: {
    source: "api",
    list: () => customers.promise,
  } as never });
  customerStore.setState({ customers: [] });
  const customerLoading = customerStore.getState().fetchCustomers();
  invalidateAdminSession();
  customers.resolve({ items: [{ id: "stale" }] } as never);
  await customerLoading;
  assert(!customerStore.getState().customers.some((customer) => customer.id === "stale"), "Late customer responses must not repopulate state after reset.");
  assert(getAccountAccessToken() === "customer-token", "Admin reset must preserve the customer access token.");
  assert(STATISTICS_PERIOD.CURRENT_WEEK === "current-week", "Statistics period contract changed unexpectedly.");
  console.log("PASS: admin lifecycle stale-response and statistics reset scenarios");
}

void run();
