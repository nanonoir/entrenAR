import { MockSalesRepository } from "@/lib/api/admin/sales/mock-sales.repository";
import { SalesApiError } from "@/lib/api/admin/sales/client";
import type { SalesRepository } from "@/lib/api/admin/sales/sales.repository";
import { createAdminSalesStore } from "@/stores/admin-sales-store";

async function run(): Promise<void> {
  const calls: string[] = [];
  const backingRepository = new MockSalesRepository();
  const repository = asApiRepository(backingRepository, calls);
  const store = createAdminSalesStore({ repository, fallbackRepository: new MockSalesRepository() });

  assert(store.getState().source === "api", "The injected API repository was not selected.");
  assert(await store.getState().fetchSales({ limit: 100 }), "Sales hydration failed.");
  assert(store.getState().hasLoaded && calls.includes("getSales"), "Sales hydration did not update state or call the repository.");

  const pendingConfirmation = store.getState().confirmSale("101");
  assert(store.getState().sales.find((sale) => sale.id === "101")?.paymentStatus === "received", "The sale mutation was not optimistic.");
  assert((await pendingConfirmation)?.id === "101" && calls.includes("confirmSale"), "The sale mutation did not settle through the repository.");

  const created = await store.getState().createManualSale({
    customer: { firstName: "Harness", lastName: "Customer", email: "harness@example.test" },
    paymentStatus: "received",
    products: [{ name: "Harness Product", productId: "product-harness", quantity: 1, unitPrice: 100 }],
    shippingCost: 25,
    subtotal: 100,
    total: 125,
  });
  assert(created !== null && store.getState().sales.some((sale) => sale.id === created.id), "Manual sale synchronization failed.");

  const purchaseOrderId = await store.getState().createPurchaseOrder({
    items: [{ productId: "product-harness", quantity: 2, title: "Harness Product", unitCost: 25 }],
    supplierId: "supplier-nutricion",
  });
  assert(purchaseOrderId !== null && calls.includes("createPurchaseOrder"), "Purchase-order creation did not call the repository.");
  assert((await store.getState().submitPurchaseOrder(purchaseOrderId!))?.status === "pending", "Purchase-order submit failed.");
  assert((await store.getState().receivePurchaseOrder(purchaseOrderId!))?.status === "converted", "Purchase-order receipt failed.");

  const conflictRepository = asApiRepository(new MockSalesRepository(), [], {
    archiveSale: async () => {
      throw new SalesApiError({ code: "CONFLICT", message: "Archive rejected.", status: 409 });
    },
  });
  const conflictStore = createAdminSalesStore({ repository: conflictRepository, fallbackRepository: new MockSalesRepository() });
  await conflictStore.getState().fetchSales({ limit: 100 });
  const beforeArchive = conflictStore.getState().sales.find((sale) => sale.id === "101")?.archived;
  assert(await conflictStore.getState().archiveSale("101") === null, "A repository conflict unexpectedly succeeded.");
  assert(conflictStore.getState().sales.find((sale) => sale.id === "101")?.archived === beforeArchive, "The failed mutation did not roll back.");
  assert(conflictStore.getState().error?.code === "CONFLICT", "The failed mutation did not expose a controlled error.");

  const unavailableRepository = asApiRepository(new MockSalesRepository(), [], {
    getSales: async () => {
      throw new SalesApiError({ code: "SALES_API_UNAVAILABLE", message: "Offline.", status: 503 });
    },
  });
  const fallbackStore = createAdminSalesStore({ repository: unavailableRepository, fallbackRepository: new MockSalesRepository() });
  assert(await fallbackStore.getState().fetchSales({ limit: 100 }), "The mock fallback did not complete hydration.");
  assert(fallbackStore.getState().isFallback && fallbackStore.getState().source === "mock", "Fallback state was not observable.");

  let apiAvailable = false;
  const retryBacking = new MockSalesRepository();
  const retryRepository = asApiRepository(retryBacking, [], {
    getSales: async (...args: unknown[]) => {
      if (!apiAvailable) throw new SalesApiError({ code: "SALES_API_UNAVAILABLE", message: "Offline.", status: 503 });
      return retryBacking.getSales(...(args as [Parameters<MockSalesRepository["getSales"]>[0]]));
    },
  });
  const retryStore = createAdminSalesStore({ repository: retryRepository, fallbackRepository: new MockSalesRepository() });
  await retryStore.getState().fetchSales({ limit: 100 });
  apiAvailable = true;
  assert(await retryStore.getState().retryLoad() && retryStore.getState().source === "api" && !retryStore.getState().isFallback, "Retry did not restore the configured API repository.");

  const mockStore = createAdminSalesStore({ repository: new MockSalesRepository() });
  await mockStore.getState().fetchSales({ limit: 100 });
  assert((await mockStore.getState().packSale("101"))?.shippingStatus === "to_ship", "The configured mock repository did not preserve transitions.");
  console.log("admin sales store harness: repository hydration, optimistic mutation, rollback, API fallback, purchase orders, and mock parity passed");
}

function asApiRepository(
  target: MockSalesRepository,
  calls: string[],
  overrides: Record<string, (...args: unknown[]) => unknown> = {},
): SalesRepository {
  return new Proxy(target, {
    get(repository, property) {
      const name = String(property);
      if (name === "source") return "api";
      const override = overrides[name];
      if (override) return (...args: unknown[]) => { calls.push(name); return override(...args); };
      const value = Reflect.get(repository, property);
      return typeof value === "function" ? (...args: unknown[]) => { calls.push(name); return value.apply(repository, args); } : value;
    },
  }) as unknown as SalesRepository;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
