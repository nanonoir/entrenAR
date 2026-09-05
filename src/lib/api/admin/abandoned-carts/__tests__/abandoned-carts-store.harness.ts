import { AbandonedCartsApiError } from "../client";
import { MockAbandonedCartsRepository } from "../mock-abandoned-carts-repository";
import type { AbandonedCartsRepository } from "../repository";
import type { AbandonedCartListQuery } from "../types";
import { createAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";

async function run(): Promise<void> {
  await runStoreScenario();
  await runRollbackScenario();
  await runFallbackAndRetryScenario();
  runMockModeScenario();
  console.log("abandoned-carts store harness: hydration, detail, optimistic mutations, rollback, retry, and mock fallback passed");
}

async function runStoreScenario(): Promise<void> {
  const calls: string[] = [];
  const repository = asApiRepository(new MockAbandonedCartsRepository(), calls);
  const store = createAdminAbandonedCartsStore(repository, new MockAbandonedCartsRepository());

  assert(store.getState().source === "api" && store.getState().carts.length === 0, "API store instantiation did not start empty.");

  const pendingList = store.getState().fetchCarts({ limit: 2, search: "Lucía" });
  assert(store.getState().isLoading, "List loading state was not set synchronously.");
  assert(await pendingList && !store.getState().isLoading, "Initial list hydration failed or did not finish loading.");
  assert(store.getState().carts[0]?.id === "CART-901" && store.getState().pagination?.total === 1, "List result was not synchronized.");
  assert(store.getState().summary?.pendingCount === 1 && calls.includes("list"), "List summary or repository delegation failed.");

  const pendingDetail = store.getState().fetchCartById("CART-901");
  assert(store.getState().isDetailLoading, "Detail loading state was not set synchronously.");
  const detail = await pendingDetail;
  assert(detail?.cartId === "cart-CART-901" && store.getState().selectedCart?.timeline.length !== 0, "Cart detail was not synchronized.");
  assert(!store.getState().isDetailLoading && calls.includes("getById"), "Detail loading state or delegation failed.");

  await store.getState().fetchConfig();
  await store.getState().fetchTemplate();
  assert(calls.includes("getConfig") && calls.includes("getTemplate"), "Configuration/template reads were not delegated.");

  const emailRequest = store.getState().sendRecoveryEmail("CART-901", "Follow up by email.");
  assert(store.getState().isMutating && store.getState().carts[0]?.recoveryStatus === "SENT", "Email mutation was not optimistic.");
  const email = await emailRequest;
  assert(email?.cart.recoveryStatus === "SENT" && store.getState().lastRecoveryLink?.cartId === "CART-901", "Email mutation did not reconcile its recovery link.");
  assert(store.getState().selectedCart?.recoveryLink?.url.includes("recoveryToken=") === true, "Selected detail did not receive the recovery link.");
  assert(!store.getState().isMutating && calls.includes("sendRecoveryEmail"), "Email mutation loading state or delegation failed.");

  const manualRequest = store.getState().markManualRecovery("CART-901", "Called customer.");
  assert(store.getState().carts[0]?.recoveryStatus === "MANUAL", "Manual recovery was not optimistic.");
  assert((await manualRequest)?.cart.recoveryStatus === "MANUAL" && store.getState().lastRecoveryLink === null, "Manual recovery did not reconcile its state.");

  const convertRequest = store.getState().convertCart("CART-901");
  assert(store.getState().carts[0]?.recoveryStatus === "RECOVERED", "Conversion was not optimistic.");
  assert((await convertRequest)?.cart.recoveryStatus === "RECOVERED" && calls.includes("convertCart"), "Conversion did not reconcile through the repository.");

  const discardStore = createLoadedStore(calls);
  assert(await discardStore.load(), "Discard scenario hydration failed.");
  const discardRequest = discardStore.getState().discardCart("CART-901", "Customer declined recovery.");
  assert(discardStore.getState().carts.some((cart) => cart.id === "CART-901" && cart.recoveryStatus === "DISCARDED"), "Discard was not optimistic.");
  assert((await discardRequest)?.cart.recoveryStatus === "DISCARDED" && calls.includes("discardCart"), "Discard did not reconcile through the repository.");

  const configRequest = store.getState().updateConfig({ timing: "6hs" });
  assert(store.getState().config.timing === "6hs", "Configuration update was not optimistic.");
  assert((await configRequest)?.timing === "6hs" && calls.includes("updateConfig"), "Configuration update did not reconcile.");

  const templateRequest = store.getState().updateTemplate({ subject: "Saved subject" });
  assert(store.getState().template.subject === "Saved subject", "Template update was not optimistic.");
  assert((await templateRequest)?.subject === "Saved subject" && calls.includes("updateTemplate"), "Template update did not reconcile.");

  store.getState().setFilters({ status: "PENDING", page: 1 });
  assert(store.getState().filters.status === "PENDING", "Filter updates were not stored.");
  store.getState().selectCart(null);
  assert(store.getState().selectedCart === null, "Cart selection was not cleared.");
}

async function runRollbackScenario(): Promise<void> {
  const calls: string[] = [];
  const repository = asApiRepository(new MockAbandonedCartsRepository(), calls, {
    sendRecoveryEmail: () => {
      throw new AbandonedCartsApiError({ code: "CONFLICT", message: "Recovery rejected.", status: 409 });
    },
    updateConfig: () => {
      throw new AbandonedCartsApiError({ code: "CONFLICT", message: "Configuration rejected.", status: 409 });
    },
  });
  const store = createAdminAbandonedCartsStore(repository, new MockAbandonedCartsRepository());
  assert(await store.getState().fetchCarts({ limit: 100 }), "Rollback scenario hydration failed.");

  const previousStatus = store.getState().carts.find((cart) => cart.id === "CART-901")?.recoveryStatus;
  const failedEmail = store.getState().sendRecoveryEmail("CART-901");
  assert(store.getState().carts.find((cart) => cart.id === "CART-901")?.recoveryStatus === "SENT", "Failed email was not optimistic before rollback.");
  assert(await failedEmail === null, "Rejected email unexpectedly succeeded.");
  assert(store.getState().carts.find((cart) => cart.id === "CART-901")?.recoveryStatus === previousStatus, "Failed email did not roll back.");
  assert(store.getState().error === "Recovery rejected." && !store.getState().isMutating, "Failed email did not expose its error or finish mutating state.");

  store.getState().clearError();
  assert(store.getState().error === null, "clearError did not clear the store error.");
  const previousTiming = store.getState().config.timing;
  const failedConfig = store.getState().updateConfig({ timing: "6hs" });
  assert(store.getState().config.timing === "6hs", "Failed configuration was not optimistic before rollback.");
  assert(await failedConfig === null && store.getState().config.timing === previousTiming, "Failed configuration did not roll back.");
  assert(store.getState().error === "Configuration rejected.", "Failed configuration did not expose its error.");
  assert(calls.includes("sendRecoveryEmail") && calls.includes("updateConfig"), "Rollback operations did not reach the repository.");
}

async function runFallbackAndRetryScenario(): Promise<void> {
  let apiAvailable = false;
  const calls: string[] = [];
  const backingRepository = new MockAbandonedCartsRepository();
  const repository = asApiRepository(backingRepository, calls, {
    list: (...args: unknown[]) => {
      if (!apiAvailable) {
        throw new AbandonedCartsApiError({ code: "ABANDONED_CARTS_API_UNAVAILABLE", message: "Offline.", status: 503 });
      }
      return backingRepository.list(args[0] as AbandonedCartListQuery | undefined);
    },
  });
  const store = createAdminAbandonedCartsStore(repository, new MockAbandonedCartsRepository());

  assert(await store.getState().fetchCarts({ limit: 100 }), "Mock fallback did not complete list hydration.");
  assert(store.getState().isFallback && store.getState().source === "mock" && store.getState().fallbackMessage, "Offline fallback state was not observable.");

  apiAvailable = true;
  assert(await store.getState().retryLoad(), "Retry did not complete after the API recovered.");
  assert(!store.getState().isFallback && store.getState().source === "api" && calls.filter((call) => call === "list").length === 2, "Retry did not restore the configured API repository.");
}

function runMockModeScenario(): void {
  const store = createAdminAbandonedCartsStore(new MockAbandonedCartsRepository());
  assert(store.getState().source === "mock" && store.getState().hasLoaded && store.getState().carts.length === 4, "Mock mode did not preserve the initial local state.");
  assert(store.getState().carts.some((cart) => cart.recoveryStatus === "DISCARDED") === false, "Legacy mock state unexpectedly contained a discarded cart.");
}

function createLoadedStore(calls: string[]) {
  const repository = asApiRepository(new MockAbandonedCartsRepository(), calls);
  const store = createAdminAbandonedCartsStore(repository, new MockAbandonedCartsRepository());
  return {
    getState: store.getState,
    load: async () => store.getState().fetchCarts({ limit: 100 }),
  } as const;
}

function asApiRepository(
  target: MockAbandonedCartsRepository,
  calls: string[],
  overrides: Record<string, (...args: unknown[]) => unknown> = {},
): AbandonedCartsRepository {
  const repository = new Proxy(target, {
    get(current, property) {
      const name = String(property);
      if (name === "source") return "api";
      const override = overrides[name];
      if (override) return (...args: unknown[]) => {
        calls.push(name);
        return override(...args);
      };
      const value = Reflect.get(current, property);
      return typeof value === "function" ? (...args: unknown[]) => {
        calls.push(name);
        return value.apply(current, args);
      } : value;
    },
  }) as unknown as AbandonedCartsRepository;
  return repository;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
