import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import type {
  AccountApiClient,
  AccountApiMethodOptions,
  AccountApiRequestOptions,
} from "./client";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountProfile,
  AccountProfileUpdate,
  AccountUser,
} from "@/types/account";

const execFileAsync = promisify(execFile);

const API_METHOD = {
  DELETE: "delete",
  GET: "get",
  POST: "post",
  PUT: "put",
  REQUEST: "request",
} as const;

type ApiMethod = (typeof API_METHOD)[keyof typeof API_METHOD];

async function run(): Promise<void> {
  if (process.argv.includes("--api-store-scenario")) {
    await runApiStoreScenario();
    return;
  }

  await runRepositoryScenario();
  await runMockRollbackScenario();
  await runApiStoreScenarioInChild();
  console.log("account adapter harness: mock default/API opt-in, DTO mapping, server authority, rollback, loading, empty, error, and legacy reconciliation passed");
}

async function runRepositoryScenario(): Promise<void> {
  const { AccountApiRepository } = await import("./account-api.repository");
  const { DATA_SOURCE, getAccountDataSource } = await import("../config");
  const { getAccountRepository } = await import("./account.repository");
  const { clearAccountAccessToken, getAccountAccessToken, setAccountAccessToken } = await import("./client");

  if (!process.env.NEXT_PUBLIC_DATA_SOURCE && getAccountDataSource() !== DATA_SOURCE.MOCK) {
    throw new Error("Account mock source must remain the default when no source is configured.");
  }
  if (getAccountRepository(DATA_SOURCE.MOCK) === getAccountRepository(DATA_SOURCE.API)) {
    throw new Error("Account API source must require explicit selection.");
  }

  const calls: ClientCall[] = [];
  const api = new AccountApiRepository(createClient(calls, async (call) => responseForRepositoryCall(call)));
  const profileInput: AccountProfileUpdate = {
    birthDate: "1991-02-03",
    dni: "87654321",
    firstName: "API",
    gender: "other",
    lastName: "Customer",
    phone: "+54 11 5555-4444",
  };
  const addressInput: AccountAddressInput = {
    city: "Buenos Aires",
    label: "Home",
    phone: "+54 11 5555-5555",
    postalCode: "C1000",
    province: "Buenos Aires",
    recipient: "API Customer",
    street: "123 Test Street",
  };

  setAccountAccessToken("stale-token");
  const session = await api.login({ email: "  API.Customer@Example.test ", password: "EphemeralPassword123!" });
  if (session.user.email !== "api.customer@example.test" || session.user.name !== "API Customer") {
    throw new Error("Account auth DTO mapping failed.");
  }
  if (getAccountAccessToken() !== "api-access-token") {
    throw new Error("Account API session token storage failed.");
  }
  if ("passwordHash" in session.user || "refreshToken" in session.user || "resetToken" in session.user) {
    throw new Error("Account auth DTO mapping leaked a secret.");
  }

  const profile = await api.getProfile();
  if (profile.email !== "api.customer@example.test" || profile.firstName !== "Server") {
    throw new Error("Account profile DTO mapping failed.");
  }
  if ("passwordHash" in profile || "userId" in profile) {
    throw new Error("Account profile DTO mapping leaked server-only data.");
  }

  const unsafeProfileInput = {
    ...profileInput,
    email: "foreign@example.test",
    userId: "foreign-user",
  } as unknown as AccountProfileUpdate;
  await api.updateProfile(unsafeProfileInput);
  const profileUpdateCall = findCall(calls, API_METHOD.PUT, "/account/profile");
  if (!profileUpdateCall || !sameRecord(profileUpdateCall.body, profileInput)) {
    throw new Error("Account profile adapter forwarded client-owned identity fields.");
  }

  const unsafeAddressInput = {
    ...addressInput,
    id: "foreign-address",
    userId: "foreign-user",
  } as unknown as AccountAddressInput;
  await api.createAddress(unsafeAddressInput);
  const addressCreateCall = findCall(calls, API_METHOD.POST, "/account/addresses");
  if (!addressCreateCall || !sameRecord(addressCreateCall.body, addressInput)) {
    throw new Error("Account address adapter forwarded client-owned identity fields.");
  }

  const addresses = await api.listAddresses();
  if (addresses.length !== 1 || addresses[0]?.id !== "address-1") {
    throw new Error("Account address DTO mapping failed.");
  }
  await api.updateAddress("address/1", unsafeAddressInput);
  await api.deleteAddress("address/1");
  await api.addToWishlist("product/1");
  await api.removeFromWishlist("product/1");
  const wishlist = await api.listWishlist();
  if (wishlist.length !== 1 || wishlist[0]?.price !== 42.5 || wishlist[0]?.stock !== 9) {
    throw new Error("Wishlist DTO mapping failed.");
  }

  const orders = await api.listOrders();
  if (orders.length !== 0) {
    throw new Error("Account order skeleton must preserve an empty server response.");
  }
  const publicAuthCall = findCall(calls, API_METHOD.POST, "/auth/login");
  if (!publicAuthCall || publicAuthCall.options?.includeAuthorization !== false) {
    throw new Error("Public account auth calls must suppress stale bearer credentials.");
  }

  await api.logout();
  if (getAccountAccessToken() !== null) {
    throw new Error("Account logout did not clear the memory-only access token.");
  }
  clearAccountAccessToken();
}

async function runMockRollbackScenario(): Promise<void> {
  const { MockAccountRepository } = await import("./mock-account.repository");
  const { clearAccountAccessToken, getAccountAccessToken, setAccountAccessToken, AccountApiError } = await import("./client");
  const { getAllProducts } = await import("@/lib/data/products");

  const mock = new MockAccountRepository();
  const user = await mock.login({ email: "rollback@example.test", password: "EphemeralPassword123!" });
  const product = getAllProducts()[0];
  if (!product) throw new Error("The mock catalog must contain a rollback product.");

  await mock.createAddress(addressInput());
  await mock.addToWishlist(product.id);
  if ((await mock.listAddresses()).length !== 1 || (await mock.listWishlist()).length !== 1) {
    throw new Error("Mock account repository did not preserve local rollback state.");
  }
  if (user.user.email !== "rollback@example.test") {
    throw new Error("Mock account login did not normalize the local user.");
  }

  setAccountAccessToken("stale-api-token");
  await mock.login({ email: "rollback-second@example.test", password: "EphemeralPassword123!" });
  if (getAccountAccessToken() !== null) {
    throw new Error("Mock account selection retained an API bearer token.");
  }

  const failing = new (await import("./account-api.repository")).AccountApiRepository(createClient([], async () => {
    throw new AccountApiError({
      code: "ACCOUNT_API_UNAVAILABLE",
      message: "The account API is unavailable.",
      status: 503,
    });
  }));
  setAccountAccessToken("stale-api-token");
  try {
    await failing.refresh();
    throw new Error("Expected API refresh failure during rollback scenario.");
  } catch (error) {
    if (!(error instanceof AccountApiError) || error.code !== "ACCOUNT_API_UNAVAILABLE") {
      throw error;
    }
  }
  if (getAccountAccessToken() !== null) {
    throw new Error("Failed API refresh did not clear the access token for rollback.");
  }
  clearAccountAccessToken();
}

async function runApiStoreScenarioInChild(): Promise<void> {
  const tsxCli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const harness = resolve(process.cwd(), "src/lib/api/account/account-adapter.harness.ts");
  const { stdout } = await execFileAsync(process.execPath, [tsxCli, harness, "--api-store-scenario"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_DATA_SOURCE: "api",
    },
    maxBuffer: 1_048_576,
  });

  if (!stdout.includes("account adapter store scenario: loading, empty, error, server authority, and legacy reconciliation passed")) {
    throw new Error("Account API store scenario did not complete.");
  }
}

async function runApiStoreScenario(): Promise<void> {
  const { DATA_SOURCE } = await import("../config");
  const { ACCOUNT_ASYNC_STATUS } = await import("@/types/account");

  if (DATA_SOURCE.API !== "api") {
    throw new Error("Account API store scenario could not select the API source.");
  }

  const mainEmail = "store-user@example.test";
  const mainUser: AccountUser = {
    birthDate: null,
    dni: null,
    email: mainEmail,
    firstName: "Store",
    gender: null,
    id: "store-user-id",
    lastName: "User",
    name: "Store User",
    phone: null,
    role: "CUSTOMER",
  };
  const emptyProfile = createProfile(mainEmail, "", "");
  const server: StoreServer = {
    addressesByEmail: new Map([[mainEmail, []]]),
    currentEmail: mainEmail,
    failPath: null,
    profilesByEmail: new Map([[mainEmail, emptyProfile]]),
    wishlistByEmail: new Map([[mainEmail, []]]),
  };
  const storage = new HarnessStorage();
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage } as unknown as Window & typeof globalThis;
  let holdFirstRefresh = true;
  let resolveRefresh: ((response: Response) => void) | undefined;
  const pendingRefresh = new Promise<Response>((resolveResponse) => {
    resolveRefresh = resolveResponse;
  });

  globalThis.fetch = async (input, init) => {
    const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(inputUrl).pathname.replace(/^\/api\/v1/, "");
    const method = init?.method ?? "GET";

    if (path === "/auth/refresh" && method === "POST" && holdFirstRefresh) {
      holdFirstRefresh = false;
      return pendingRefresh;
    }
    if (server.failPath === path) {
      throw new Error("Simulated account API outage.");
    }
    if (path === "/auth/refresh" && method === "POST") {
      return jsonResponse({ accessToken: "store-api-token", user: mainUser });
    }
    if (path === "/auth/me" && method === "GET") {
      return jsonResponse(mainUser);
    }
    if (path === "/account/profile" && method === "GET") {
      return jsonResponse(server.profilesByEmail.get(server.currentEmail) ?? createProfile(server.currentEmail, "", ""));
    }
    if (path === "/account/profile" && method === "PUT") {
      const body = requestRecord(init);
      const profile = {
        ...createProfile(server.currentEmail, "", ""),
        ...body,
        email: server.currentEmail,
      } as AccountProfile;
      server.profilesByEmail.set(server.currentEmail, profile);
      return jsonResponse(profile);
    }
    if (path === "/account/addresses" && method === "GET") {
      return jsonResponse(server.addressesByEmail.get(server.currentEmail) ?? []);
    }
    if (path === "/account/addresses" && method === "POST") {
      const address = {
        ...requestRecord(init),
        id: `store-address-${(server.addressesByEmail.get(server.currentEmail) ?? []).length + 1}`,
      } as AccountAddress;
      const addresses = server.addressesByEmail.get(server.currentEmail) ?? [];
      server.addressesByEmail.set(server.currentEmail, [...addresses, address]);
      return jsonResponse(address, 201);
    }
    if (path.startsWith("/account/addresses/") && method === "PUT") {
      const id = decodeURIComponent(path.slice("/account/addresses/".length));
      const body = requestRecord(init);
      const addresses = server.addressesByEmail.get(server.currentEmail) ?? [];
      const updated = { ...body, id } as AccountAddress;
      server.addressesByEmail.set(server.currentEmail, addresses.map((address) => address.id === id ? updated : address));
      return jsonResponse(updated);
    }
    if (path.startsWith("/account/addresses/") && method === "DELETE") {
      const id = decodeURIComponent(path.slice("/account/addresses/".length));
      const addresses = server.addressesByEmail.get(server.currentEmail) ?? [];
      server.addressesByEmail.set(server.currentEmail, addresses.filter((address) => address.id !== id));
      return jsonResponse({ ok: true });
    }
    if (path === "/account/orders" && method === "GET") {
      return jsonResponse([]);
    }
    if (path === "/wishlist" && method === "GET") {
      return jsonResponse((server.wishlistByEmail.get(server.currentEmail) ?? []).map(wishlistDto));
    }
    if (path.startsWith("/wishlist/") && method === "POST") {
      const id = decodeURIComponent(path.slice("/wishlist/".length));
      const productIds = server.wishlistByEmail.get(server.currentEmail) ?? [];
      if (!productIds.includes(id)) server.wishlistByEmail.set(server.currentEmail, [...productIds, id]);
      return jsonResponse({ ok: true }, 201);
    }
    if (path.startsWith("/wishlist/") && method === "DELETE") {
      const id = decodeURIComponent(path.slice("/wishlist/".length));
      const productIds = server.wishlistByEmail.get(server.currentEmail) ?? [];
      server.wishlistByEmail.set(server.currentEmail, productIds.filter((productId) => productId !== id));
      return jsonResponse({ ok: true });
    }
    throw new Error(`Unhandled store harness request: ${method} ${path}`);
  };

  const { useAuthStore } = await import("../../../stores/auth-store");
  const { useAccountProfileStore } = await import("../../../stores/account-profile-store");
  const { useWishlistStore } = await import("../../../stores/wishlist-store");

  const bootstrapPromise = useAuthStore.getState().bootstrap();
  if (useAuthStore.getState().status !== ACCOUNT_ASYNC_STATUS.LOADING) {
    throw new Error("Account auth bootstrap did not expose loading state.");
  }
  if (!resolveRefresh) throw new Error("Account refresh request was not started.");
  resolveRefresh(jsonResponse({ accessToken: "store-api-token", user: mainUser }));
  if (!await bootstrapPromise) {
    throw new Error(`API account bootstrap failed: ${JSON.stringify(useAuthStore.getState().error)}`);
  }
  if (useAuthStore.getState().status !== ACCOUNT_ASYNC_STATUS.SUCCESS || useAuthStore.getState().user?.email !== mainEmail) {
    throw new Error("Account API bootstrap did not expose the authenticated user.");
  }
  if (
    useAccountProfileStore.getState().profileStatus !== ACCOUNT_ASYNC_STATUS.SUCCESS ||
    useAccountProfileStore.getState().addressesStatus !== ACCOUNT_ASYNC_STATUS.SUCCESS ||
    useWishlistStore.getState().status !== ACCOUNT_ASYNC_STATUS.SUCCESS ||
    useAccountProfileStore.getState().addressesByEmail[mainEmail]?.length !== 0 ||
    useWishlistStore.getState().productIds.length !== 0
  ) {
    throw new Error("Account API bootstrap did not preserve explicit empty states.");
  }

  server.failPath = "/account/profile";
  const failedLoad = useAccountProfileStore.getState().load(mainEmail);
  if (useAccountProfileStore.getState().profileStatus !== ACCOUNT_ASYNC_STATUS.LOADING) {
    throw new Error("Account profile reload did not expose loading state.");
  }
  if (await failedLoad) {
    throw new Error("Account profile outage unexpectedly succeeded.");
  }
  if (
    useAccountProfileStore.getState().profileStatus !== ACCOUNT_ASYNC_STATUS.ERROR ||
    useAccountProfileStore.getState().profileError?.code !== "ACCOUNT_API_UNAVAILABLE"
  ) {
    throw new Error("Account profile outage did not expose a controlled error state.");
  }
  server.failPath = null;

  const legacyEmail = "legacy-user@example.test";
  server.currentEmail = legacyEmail;
  server.profilesByEmail.set(legacyEmail, createProfile(legacyEmail, "", ""));
  server.addressesByEmail.set(legacyEmail, []);
  server.wishlistByEmail.set(legacyEmail, []);
  useAccountProfileStore.getState().setActiveUser(legacyEmail);
  useAccountProfileStore.setState({
    legacyAddressesByEmail: { [legacyEmail]: [addressInputWithId("legacy-address")] },
    legacyProfilesByEmail: { [legacyEmail]: createProfile(legacyEmail, "Legacy", "Customer") },
  });
  useWishlistStore.getState().setActiveUser(legacyEmail);
  useWishlistStore.setState({ legacyProductIds: ["legacy-product"] });
  if (!await useAccountProfileStore.getState().load(legacyEmail)) {
    throw new Error("Legacy account profile reconciliation failed.");
  }
  if (!await useWishlistStore.getState().load(legacyEmail)) {
    throw new Error("Legacy wishlist reconciliation failed.");
  }
  if (
    useAccountProfileStore.getState().profilesByEmail[legacyEmail]?.firstName !== "Legacy" ||
    useAccountProfileStore.getState().addressesByEmail[legacyEmail]?.length !== 1 ||
    useAccountProfileStore.getState().legacyProfilesByEmail[legacyEmail] ||
    useAccountProfileStore.getState().legacyAddressesByEmail[legacyEmail] ||
    useWishlistStore.getState().productIds[0] !== "legacy-product" ||
    useWishlistStore.getState().legacyProductIds.length !== 0
  ) {
    throw new Error("Empty server account data did not reconcile legacy snapshots exactly once.");
  }

  const authoritativeEmail = "authoritative-user@example.test";
  const authoritativeProfile = createProfile(authoritativeEmail, "Server", "Authority");
  const authoritativeAddress = addressInputWithId("server-address");
  server.currentEmail = authoritativeEmail;
  server.profilesByEmail.set(authoritativeEmail, authoritativeProfile);
  server.addressesByEmail.set(authoritativeEmail, [authoritativeAddress]);
  server.wishlistByEmail.set(authoritativeEmail, ["server-product"]);
  useAccountProfileStore.getState().setActiveUser(authoritativeEmail);
  useAccountProfileStore.setState({
    legacyAddressesByEmail: { [authoritativeEmail]: [addressInputWithId("stale-address")] },
    legacyProfilesByEmail: { [authoritativeEmail]: createProfile(authoritativeEmail, "Stale", "Snapshot") },
  });
  useWishlistStore.getState().setActiveUser(authoritativeEmail);
  useWishlistStore.setState({ legacyProductIds: ["stale-product"] });
  await useAccountProfileStore.getState().load(authoritativeEmail);
  await useWishlistStore.getState().load(authoritativeEmail);
  if (
    useAccountProfileStore.getState().profilesByEmail[authoritativeEmail]?.firstName !== "Server" ||
    useAccountProfileStore.getState().addressesByEmail[authoritativeEmail]?.[0]?.id !== "server-address" ||
    useWishlistStore.getState().productIds[0] !== "server-product"
  ) {
    throw new Error("Server account data did not remain authoritative over stale snapshots.");
  }

  console.log("account adapter store scenario: loading, empty, error, server authority, and legacy reconciliation passed");
}

function createClient(
  calls: ClientCall[],
  responder: (call: ClientCall) => Promise<unknown> | unknown,
): AccountApiClient {
  const invoke = <T>(call: ClientCall): Promise<T> => {
    calls.push(call);
    return Promise.resolve(responder(call)).then((value) => value as T);
  };

  return {
    delete: <T>(path: string, options: AccountApiMethodOptions = {}) => invoke<T>({ method: API_METHOD.DELETE, options, path }),
    get: <T>(path: string, options: AccountApiMethodOptions = {}) => invoke<T>({ method: API_METHOD.GET, options, path }),
    post: <T>(path: string, body?: unknown, options: AccountApiMethodOptions = {}) => invoke<T>({ body, method: API_METHOD.POST, options, path }),
    put: <T>(path: string, body?: unknown, options: AccountApiMethodOptions = {}) => invoke<T>({ body, method: API_METHOD.PUT, options, path }),
    request: <T>(path: string, options: AccountApiRequestOptions = {}) => invoke<T>({ body: options.body, method: API_METHOD.REQUEST, options, path }),
  };
}

async function responseForRepositoryCall(call: ClientCall): Promise<unknown> {
  if (call.method === API_METHOD.POST && call.path === "/auth/login") {
    return {
      accessToken: "api-access-token",
      user: {
        birthDate: null,
        dni: null,
        email: "api.customer@example.test",
        firstName: "API",
        gender: "other",
        id: "api-user-id",
        lastName: "Customer",
        passwordHash: "secret",
        phone: null,
        refreshToken: "secret",
        resetToken: "secret",
        role: "CUSTOMER",
      },
    };
  }
  if (call.method === API_METHOD.GET && call.path === "/auth/me") {
    return { email: "api.customer@example.test", firstName: "API", id: "api-user-id", lastName: "Customer", role: "CUSTOMER" };
  }
  if (call.method === API_METHOD.GET && call.path === "/account/profile") {
    return { birthDate: "1990-01-01", dni: "12345678", email: "api.customer@example.test", firstName: "Server", gender: "other", lastName: "Authority", passwordHash: "secret", phone: "+54 11 5555-5555" };
  }
  if (call.method === API_METHOD.GET && call.path === "/account/addresses") {
    return [addressInputWithId("address-1")];
  }
  if (call.method === API_METHOD.GET && call.path.startsWith("/account/orders?")) {
    return [];
  }
  if (call.method === API_METHOD.GET && call.path === "/wishlist") {
    return [wishlistDto("product-1")];
  }
  if (call.method === API_METHOD.POST && call.path === "/account/addresses") {
    return addressInputWithId("address-1");
  }
  if (call.method === API_METHOD.PUT && call.path.startsWith("/account/addresses/")) {
    return addressInputWithId("address/1");
  }
  if (call.method === API_METHOD.PUT && call.path === "/account/profile") {
    return { birthDate: "1991-02-03", dni: "87654321", email: "api.customer@example.test", firstName: "API", gender: "other", lastName: "Customer", phone: "+54 11 5555-4444" };
  }
  if (call.method === API_METHOD.POST && call.path === "/auth/logout") {
    return undefined;
  }
  if (call.method === API_METHOD.POST || call.method === API_METHOD.PUT || call.method === API_METHOD.DELETE) {
    return { ok: true };
  }

  throw new Error(`Unhandled account repository harness call: ${call.method} ${call.path}`);
}

function findCall(calls: readonly ClientCall[], method: ApiMethod, path: string): ClientCall | undefined {
  return calls.find((call) => call.method === method && call.path === path);
}

function sameRecord(value: unknown, expected: Record<string, string>): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(expected);
  return keys.length === Object.keys(value).length && keys.every((key) => value[key] === expected[key]);
}

function addressInput(): AccountAddressInput {
  return {
    city: "Buenos Aires",
    label: "Home",
    phone: "+54 11 5555-5555",
    postalCode: "C1000",
    province: "Buenos Aires",
    recipient: "Fixture Customer",
    street: "123 Test Street",
  };
}

function addressInputWithId(id: string): AccountAddress {
  return { ...addressInput(), id };
}

function createProfile(email: string, firstName: string, lastName: string): AccountProfile {
  return {
    birthDate: firstName ? "1990-01-01" : "",
    dni: firstName ? "12345678" : "",
    email,
    firstName,
    gender: firstName ? "other" : "",
    lastName,
    phone: firstName ? "+54 11 5555-5555" : "",
  };
}

function wishlistDto(id: string): Record<string, unknown> {
  return {
    brand: "EntrenAR",
    categoryName: "Proteínas",
    categorySlug: "proteinas",
    id,
    imageTone: "green",
    isBestSeller: false,
    isFeatured: false,
    name: "Wishlist Product",
    price: "42.50",
    rating: "4.5",
    reviews: "2",
    shortDescription: "A wishlist fixture.",
    slug: "wishlist-product",
    stock: "9",
    subcategorySlugs: [],
    tags: ["fixture"],
  };
}

function requestRecord(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== "string") return {};
  const value: unknown = JSON.parse(init.body);
  return isRecord(value) ? value : {};
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(value === undefined ? null : JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ClientCall {
  body?: unknown;
  method: ApiMethod;
  options?: AccountApiMethodOptions | AccountApiRequestOptions;
  path: string;
}

interface StoreServer {
  addressesByEmail: Map<string, AccountAddress[]>;
  currentEmail: string;
  failPath: string | null;
  profilesByEmail: Map<string, AccountProfile>;
  wishlistByEmail: Map<string, string[]>;
}

class HarnessStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
