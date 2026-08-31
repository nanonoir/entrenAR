import { execFile } from "node:child_process";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import type { CommerceApiClient, CommerceApiMethodOptions, CommerceApiRequestOptions } from "./client";
import type {
  BankTransferConfig,
  CreateCouponDTO,
  CreateShippingDiscountDTO,
  PaymentProviderId,
  UpdateShippingProviderDTO,
} from "./commerce.repository";
import type { CouponFormValues, ShippingDiscountFormValues } from "@/schemas/admin/discount-schemas";

const execFileAsync = promisify(execFile);

const API_METHOD = {
  DELETE: "delete",
  GET: "get",
  POST: "post",
  PUT: "put",
  REQUEST: "request",
} as const;

type ApiMethod = (typeof API_METHOD)[keyof typeof API_METHOD];

const COMMERCE_UI_ROOTS = [
  "src/components/admin/payment-methods",
  "src/components/admin/shipping",
  "src/components/admin/discounts",
  "src/app/(admin)/admin/medios-de-pago",
  "src/app/(admin)/admin/envios/medios-de-envio",
  "src/app/(admin)/admin/descuentos",
] as const;

const REPRESENTATIVE_MOCK_PATHS = [
  "src/lib/api/commerce/mock-commerce.repository.ts",
  "src/lib/data/admin/payment-methods/index.ts",
  "src/lib/data/admin/shipping/shipping-config.ts",
  "src/lib/data/admin/discounts/types.ts",
  "src/lib/data/admin/sales-flow/mock-products.ts",
] as const;

const PAYMENT_PROVIDER_IDS = ["bank-transfer", "mercado-pago", "stripe", "payway"] as const;
const DEFAULT_OPEN_ENDED_MAX_GRAMS = 999999;

async function run(): Promise<void> {
  if (process.argv.includes("--mock-source-scenario")) {
    await runMockSourceScenario();
    return;
  }
  if (process.argv.includes("--api-store-scenario")) {
    await runApiStoreScenario();
    return;
  }

  await assertMockRemovalGuard();
  await assertSourceBoundaries();
  await runMockDefaultScenarioInChild();
  await runRepositoryScenario();
  await runFetchClientScenario();
  await runApiStoreScenarioInChild();
  console.log("commerce adapter harness: mock default/API opt-in, mapping, loading/empty/error states, auth, rollback, nullable weights, source boundaries, and mock retention passed");
}

async function assertMockRemovalGuard(): Promise<void> {
  await Promise.all(REPRESENTATIVE_MOCK_PATHS.map(async (path) => {
    try {
      await access(resolve(process.cwd(), path));
    } catch {
      throw new Error(`Commerce mock-removal gate failed; representative mock is missing: ${path}`);
    }
  }));
}

async function assertSourceBoundaries(): Promise<void> {
  const uiFiles = await collectSourceFiles(COMMERCE_UI_ROOTS);
  const frontendFiles = await collectSourceFiles(["src"]);
  const directFetchCalls: string[] = [];
  const forbiddenImports: string[] = [];

  for (const path of frontendFiles) {
    const source = await readFile(resolve(process.cwd(), path), "utf8");
    const scan = scanSourceFile(path, source);
    if (uiFiles.includes(path)) directFetchCalls.push(...scan.fetchCalls);
    forbiddenImports.push(...scan.forbiddenImports);
  }

  if (directFetchCalls.length || forbiddenImports.length) {
    const details = [...directFetchCalls, ...forbiddenImports].sort().join("\n");
    throw new Error(`Commerce frontend source boundary scan failed:\n${details}`);
  }
}

async function collectSourceFiles(roots: readonly string[]): Promise<string[]> {
  const files = await Promise.all(roots.map((root) => collectSourceFilesFromRoot(root)));
  return [...new Set(files.flat().map(normalizePath))].sort();
}

async function collectSourceFilesFromRoot(root: string): Promise<string[]> {
  const absoluteRoot = resolve(process.cwd(), root);
  const rootStats = await stat(absoluteRoot);
  if (rootStats.isFile()) return isSourceFile(root) ? [root] : [];

  const entries = (await readdir(absoluteRoot, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
  const nested = await Promise.all(entries.map((entry) => collectSourceFilesFromRoot(join(root, entry.name))));
  return nested.flat().sort();
}

function isSourceFile(path: string): boolean {
  return /\.(?:ts|tsx)$/.test(path) && !path.endsWith(".d.ts");
}

function scanSourceFile(path: string, source: string): { fetchCalls: string[]; forbiddenImports: string[] } {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fetchCalls: string[] = [];
  const forbiddenImports: string[] = [];

  const recordModule = (moduleName: string, node: ts.Node) => {
    if (isForbiddenFrontendModule(moduleName)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      forbiddenImports.push(`${normalizePath(path)}:${line} forbidden module ${moduleName}`);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        fetchCalls.push(`${normalizePath(path)}:${line} direct fetch() call`);
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === "require" && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        recordModule(node.arguments[0].text, node);
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        recordModule(node.arguments[0].text, node);
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) recordModule(node.moduleSpecifier.text, node);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) recordModule(node.moduleSpecifier.text, node);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { fetchCalls, forbiddenImports };
}

function isForbiddenFrontendModule(moduleName: string): boolean {
  const normalized = moduleName.toLowerCase();
  return normalized.includes("@prisma/")
    || /(^|[\\/_.-])prisma([\\/_.-]|$)/.test(normalized)
    || /(^|[\\/_.-])database([\\/_.-]|$)/.test(normalized);
}

async function runMockDefaultScenarioInChild(): Promise<void> {
  const environment = { ...process.env };
  delete environment.NEXT_PUBLIC_DATA_SOURCE;
  delete environment.NEXT_PUBLIC_COMMERCE_DATA_SOURCE;
  const { stdout } = await runHarnessChild(["--mock-source-scenario"], environment);
  if (!stdout.includes("commerce adapter mock source scenario passed")) throw new Error("Commerce mock source scenario did not complete.");
}

async function runMockSourceScenario(): Promise<void> {
  const { DATA_SOURCE, getCommerceDataSource } = await import("../config");
  const { getCommerceRepository } = await import("./commerce.repository");
  if (getCommerceDataSource() !== DATA_SOURCE.MOCK || getCommerceRepository().source !== DATA_SOURCE.MOCK) {
    throw new Error("Commerce mock source must remain the default when no source is configured.");
  }
  const mock = getCommerceRepository(DATA_SOURCE.MOCK);
  const api = getCommerceRepository(DATA_SOURCE.API);
  const [methods, providers, pickups] = await Promise.all([mock.getPaymentMethods(), mock.getShippingProviders(), mock.getPickupPoints()]);
  if (mock === api || methods.length !== 4 || providers.length !== 2 || pickups.filter((point) => point.isMain).length !== 1) {
    throw new Error("Commerce source selection or representative mock mapping failed.");
  }
  console.log("commerce adapter mock source scenario passed");
}

async function runRepositoryScenario(): Promise<void> {
  const { CommerceApiRepository } = await import("./api-commerce.repository");
  const { MockCommerceRepository } = await import("./mock-commerce.repository");
  const { DATA_SOURCE, getCommerceRepository } = await import("./commerce.repository");
  if (getCommerceRepository(DATA_SOURCE.MOCK) === getCommerceRepository(DATA_SOURCE.API)) throw new Error("Explicit commerce API selection must use a distinct repository.");

  const mock = new MockCommerceRepository();
  const mockCoupon = await mock.createCoupon(couponInput());
  const mockDiscount = await mock.createShippingDiscount(shippingDiscountInput());
  const [mockMethods, mockProviders, mockPickups] = await Promise.all([mock.getPaymentMethods(), mock.getShippingProviders(), mock.getPickupPoints()]);
  if (mockMethods.length !== 4 || mockProviders.length !== 2 || mockPickups[0]?.id !== "retiro-principal" || mockCoupon.code !== "HARNESS10" || mockDiscount.id.length === 0) {
    throw new Error("Commerce mock adapter mapping failed.");
  }

  const calls: ClientCall[] = [];
  const api = new CommerceApiRepository(createClient(calls, responseForRepositoryCall));
  const methods = await api.getPaymentMethods();
  if (methods.length !== 4 || !methods[0]?.bankConfig || methods[1]?.bankConfig) throw new Error("Payment API mapping or bank-instruction restriction failed.");
  await api.updatePaymentMethod("bank-transfer", { bankConfig: bankConfig(), selectedOptionId: "direct-transfer", status: "active" });

  const providers = await api.getShippingProviders();
  const provider = providers[0];
  if (!provider || provider.weightRanges.at(-1)?.maxGrams !== DEFAULT_OPEN_ENDED_MAX_GRAMS) throw new Error("Nullable open-ended weight mapping failed.");
  const providerInput: UpdateShippingProviderDTO = {
    enabledModalities: [...provider.enabledModalities],
    origin: { ...provider.origin },
    status: provider.status,
    weightRanges: provider.weightRanges.map((range) => ({ ...range })),
  };
  await api.updateShippingProvider(provider.id, providerInput);
  const providerCall = findCall(calls, API_METHOD.PUT, `/admin/shipping/providers/${provider.id}`);
  const sentRanges = providerCall && isRecord(providerCall.body) && Array.isArray(providerCall.body.weightRanges) ? providerCall.body.weightRanges : [];
  const sentLastRange = sentRanges.at(-1);
  if (!isRecord(sentLastRange) || sentLastRange.maxGrams !== null) throw new Error("Open-ended weight mapping was not sent as nullable maxGrams.");

  const pickup = (await api.getPickupPoints())[0];
  if (!pickup || pickup.schedule.length !== 1) throw new Error("Pickup API mapping failed.");
  await api.updatePickupPoint(pickup.id, { ...pickup, address: { ...pickup.address }, provinces: [...pickup.provinces], schedule: pickup.schedule.map((range) => ({ ...range })) });

  const coupons = await api.getCoupons();
  if (coupons[0]?.code !== "WELCOME10" || coupons[0]?.history[0]?.userName !== "Admin API") throw new Error("Coupon history API mapping failed.");
  await api.createCoupon(couponInput());
  await api.updateCoupon("coupon-api", couponInput());
  await api.deleteCoupon("coupon-api");

  const discounts = await api.getShippingDiscounts();
  if (discounts[0]?.id !== "shipping-discount-api") throw new Error("Shipping discount API mapping failed.");
  await api.createShippingDiscount(shippingDiscountInput());
  await api.updateShippingDiscount("shipping-discount-api", shippingDiscountInput());
  await api.deleteShippingDiscount("shipping-discount-api");
}

async function runFetchClientScenario(): Promise<void> {
  const { CommerceApiError, FetchCommerceApiClient, toCommerceApiError } = await import("./client");
  const { clearAccountAccessToken, getAccountAccessToken, setAccountAccessToken } = await import("../account/client");
  const calls: FetchCall[] = [];
  let protectedAttempts = 0;
  setAccountAccessToken("stale-token");
  const client = new FetchCommerceApiClient(async (input, init) => {
    const call = fetchCall(input, init);
    calls.push(call);
    if (call.path === "/protected" && protectedAttempts++ === 0) return jsonResponse({ code: "AUTH_REQUIRED", message: "Sign in required", ok: false }, 401);
    if (call.path === "/auth/refresh") return jsonResponse({ accessToken: "fresh-token" });
    if (call.path === "/protected") return jsonResponse({ ok: true });
    throw new Error(`Unexpected fetch client call: ${call.method} ${call.path}`);
  }, "https://commerce.test/api/v1");
  const protectedResponse = await client.get<{ ok: boolean }>("/protected");
  if (!protectedResponse.ok || calls.map((call) => `${call.method} ${call.path}`).join(",") !== "GET /protected,POST /auth/refresh,GET /protected" || calls[0]?.authorization !== "Bearer stale-token" || calls[1]?.authorization || calls[2]?.authorization !== "Bearer fresh-token" || getAccountAccessToken() !== "fresh-token") {
    throw new Error("Commerce auth refresh and bearer handling failed.");
  }

  const validation = new FetchCommerceApiClient(async () => jsonResponse({ code: "VALIDATION_ERROR", issues: [{ code: "INVALID_FIELD", field: "code", message: "Invalid code." }], message: "Validation failed", ok: false }, 422), "https://commerce.test/api/v1");
  try {
    await validation.post("/admin/discounts/coupons", couponInput());
    throw new Error("Expected controlled commerce validation error.");
  } catch (error) {
    if (!(error instanceof CommerceApiError) || error.code !== "VALIDATION_ERROR" || error.status !== 422 || error.issues[0]?.field !== "code") throw error;
  }

  setAccountAccessToken("stale-token");
  const refreshFailure = new FetchCommerceApiClient(async (input, init) => {
    const call = fetchCall(input, init);
    if (call.path === "/protected") return jsonResponse({ code: "AUTH_REQUIRED", message: "Expired", ok: false }, 401);
    if (call.path === "/auth/refresh") return jsonResponse({ code: "REFRESH_EXPIRED", message: "Refresh expired", ok: false }, 401);
    throw new Error(`Unexpected refresh failure call: ${init?.method ?? "GET"} ${call.path}`);
  }, "https://commerce.test/api/v1");
  try {
    await refreshFailure.get("/protected");
    throw new Error("Expected refresh failure.");
  } catch (error) {
    if (!(error instanceof CommerceApiError) || error.code !== "REFRESH_EXPIRED" || getAccountAccessToken() !== null) throw error;
  }
  if (toCommerceApiError(new Error("fallback"), "FALLBACK_CODE", "Fallback message").code !== "FALLBACK_CODE") throw new Error("Unknown commerce errors were not controlled.");
  clearAccountAccessToken();
}

async function runApiStoreScenarioInChild(): Promise<void> {
  const { stdout } = await runHarnessChild(["--api-store-scenario"], { ...process.env, NEXT_PUBLIC_COMMERCE_DATA_SOURCE: "api" });
  if (!stdout.includes("commerce adapter store scenario passed")) throw new Error("Commerce API store scenario did not complete.");
}

async function runApiStoreScenario(): Promise<void> {
  let mode: "empty" | "success" = "success";
  let failurePath: string | null = null;
  let controlledFailurePath: string | null = null;
  let holdPaymentRequest = true;
  const paymentGate = deferred<Response>();

  globalThis.fetch = async (input, init) => {
    const call = fetchCall(input, init);
    if (call.path === "/auth/refresh") return jsonResponse({ accessToken: "store-token" });
    if (call.path === "/admin/payment-methods" && call.method === "GET" && holdPaymentRequest) {
      holdPaymentRequest = false;
      return paymentGate.promise;
    }
    if (failurePath === call.path) throw new Error(`Simulated commerce outage at ${call.path}`);
    if (controlledFailurePath === call.path && call.method === "POST") return jsonResponse({ code: "COUPON_CODE_ALREADY_EXISTS", issues: [{ code: "DUPLICATE", field: "code", message: "An active coupon already exists." }], message: "An active coupon already exists.", ok: false }, 409);
    return jsonResponse(storeResponse(call.path, call.method, mode));
  };

  const { COMMERCE_ASYNC_STATUS } = await import("@/stores/admin-commerce-state");
  const { useAdminPaymentMethodsStore } = await import("@/stores/admin-payment-methods-store");
  const { useAdminShippingStore } = await import("@/stores/admin-shipping-store");
  const { useAdminDiscountsStore } = await import("@/stores/admin-discounts-store");

  const paymentLoad = useAdminPaymentMethodsStore.getState().load();
  if (useAdminPaymentMethodsStore.getState().status !== COMMERCE_ASYNC_STATUS.LOADING) throw new Error("Payment store did not expose loading state.");
  paymentGate.resolve(jsonResponse(rawPaymentMethods()));
  if (!await paymentLoad || useAdminPaymentMethodsStore.getState().status !== COMMERCE_ASYNC_STATUS.SUCCESS || useAdminPaymentMethodsStore.getState().providers["bank-transfer"].bankConfig?.alias !== "ENTRENAR.API") throw new Error("Payment store success or mapping failed.");

  const paymentBeforeError = JSON.stringify(useAdminPaymentMethodsStore.getState().providers);
  failurePath = "/admin/payment-methods";
  if (await useAdminPaymentMethodsStore.getState().load() || useAdminPaymentMethodsStore.getState().status !== COMMERCE_ASYNC_STATUS.ERROR || useAdminPaymentMethodsStore.getState().error?.code !== "COMMERCE_API_UNAVAILABLE" || JSON.stringify(useAdminPaymentMethodsStore.getState().providers) !== paymentBeforeError) throw new Error("Payment store error preservation failed.");
  failurePath = "/admin/payment-methods/bank-transfer";
  if (await useAdminPaymentMethodsStore.getState().updateProviderConfig("bank-transfer", { status: "inactive" }) || JSON.stringify(useAdminPaymentMethodsStore.getState().providers) !== paymentBeforeError) throw new Error("Payment store mutation rollback failed.");
  failurePath = null;

  mode = "empty";
  const shippingEmptyLoad = useAdminShippingStore.getState().load();
  if (useAdminShippingStore.getState().status !== COMMERCE_ASYNC_STATUS.LOADING || !await shippingEmptyLoad || !useAdminShippingStore.getState().providersEmpty || !useAdminShippingStore.getState().pickupPointsEmpty || !useAdminShippingStore.getState().isEmpty) throw new Error("Shipping store empty transition failed.");
  mode = "success";
  if (!await useAdminShippingStore.getState().load() || useAdminShippingStore.getState().providers[0]?.weightRanges.at(-1)?.maxGrams !== DEFAULT_OPEN_ENDED_MAX_GRAMS || useAdminShippingStore.getState().pickupPoints[0]?.id !== "pickup-api") throw new Error("Shipping store success or nullable weight mapping failed.");
  const provider = useAdminShippingStore.getState().providers[0];
  if (!provider) throw new Error("Shipping store success fixture is missing.");
  const providerBeforeError = JSON.stringify(useAdminShippingStore.getState().providers);
  failurePath = `/admin/shipping/providers/${provider.id}`;
  if (await useAdminShippingStore.getState().saveProviderConfig(provider) || JSON.stringify(useAdminShippingStore.getState().providers) !== providerBeforeError) throw new Error("Shipping store rollback failed.");
  failurePath = null;

  mode = "empty";
  const discountsEmptyLoad = useAdminDiscountsStore.getState().load();
  if (useAdminDiscountsStore.getState().status !== COMMERCE_ASYNC_STATUS.LOADING || !await discountsEmptyLoad || !useAdminDiscountsStore.getState().couponsEmpty || !useAdminDiscountsStore.getState().shippingDiscountsEmpty) throw new Error("Discount store empty transition failed.");
  mode = "success";
  if (!await useAdminDiscountsStore.getState().load() || useAdminDiscountsStore.getState().coupons[0]?.code !== "WELCOME10" || useAdminDiscountsStore.getState().shippingDiscounts[0]?.id !== "shipping-discount-api") throw new Error("Discount store success mapping failed.");
  const couponsBeforeError = JSON.stringify(useAdminDiscountsStore.getState().coupons);
  controlledFailurePath = "/admin/discounts/coupons";
  if (await useAdminDiscountsStore.getState().createCouponAsync(couponInput()) || useAdminDiscountsStore.getState().status !== COMMERCE_ASYNC_STATUS.ERROR || useAdminDiscountsStore.getState().error?.code !== "COUPON_CODE_ALREADY_EXISTS" || useAdminDiscountsStore.getState().error?.issues[0]?.field !== "code" || JSON.stringify(useAdminDiscountsStore.getState().coupons) !== couponsBeforeError) throw new Error("Discount store controlled error or rollback failed.");
  console.log("commerce adapter store scenario passed");
}

function storeResponse(path: string, method: string, mode: "empty" | "success"): unknown {
  if (method === "GET" && ["/admin/payment-methods", "/admin/shipping/providers", "/admin/pickup-points", "/admin/discounts/coupons", "/admin/discounts/shipping"].includes(path)) {
    if (mode === "empty" && path !== "/admin/payment-methods") return [];
    if (mode === "empty") return [];
    if (path === "/admin/payment-methods") return rawPaymentMethods();
    if (path === "/admin/shipping/providers") return [rawShippingProvider()];
    if (path === "/admin/pickup-points") return [rawPickupPoint()];
    if (path === "/admin/discounts/coupons") return [rawCoupon()];
    return [rawShippingDiscount()];
  }
  if (path.startsWith("/admin/payment-methods/")) return rawPaymentMethod("bank-transfer", "inactive");
  if (path.startsWith("/admin/shipping/providers/")) return rawShippingProvider();
  if (path.startsWith("/admin/pickup-points/")) return rawPickupPoint();
  if (path.startsWith("/admin/discounts/coupons")) return rawCoupon();
  if (path.startsWith("/admin/discounts/shipping")) return rawShippingDiscount();
  if (method === "DELETE") return { ok: true };
  throw new Error(`Unhandled commerce store harness request: ${method} ${path}`);
}

async function runHarnessChild(args: string[], env: NodeJS.ProcessEnv) {
  const tsxCli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const harness = resolve(process.cwd(), "src/lib/api/commerce/commerce-adapter.harness.ts");
  return execFileAsync(process.execPath, [tsxCli, harness, ...args], { cwd: process.cwd(), env, maxBuffer: 1_048_576 });
}

function createClient(calls: ClientCall[], responder: (call: ClientCall) => Promise<unknown> | unknown): CommerceApiClient {
  const invoke = <T>(call: ClientCall): Promise<T> => {
    calls.push(call);
    return Promise.resolve(responder(call)).then((value) => value as T);
  };
  return {
    delete: <T>(path: string, options: CommerceApiMethodOptions = {}) => invoke<T>({ method: API_METHOD.DELETE, options, path }),
    get: <T>(path: string, options: CommerceApiMethodOptions = {}) => invoke<T>({ method: API_METHOD.GET, options, path }),
    post: <T>(path: string, body?: unknown, options: CommerceApiMethodOptions = {}) => invoke<T>({ body, method: API_METHOD.POST, options, path }),
    put: <T>(path: string, body?: unknown, options: CommerceApiMethodOptions = {}) => invoke<T>({ body, method: API_METHOD.PUT, options, path }),
    request: <T>(path: string, options: CommerceApiRequestOptions = {}) => invoke<T>({ body: options.body, method: API_METHOD.REQUEST, options, path }),
  };
}

async function responseForRepositoryCall(call: ClientCall): Promise<unknown> {
  if (call.method === API_METHOD.GET && call.path === "/admin/payment-methods") return { data: rawPaymentMethods(), ok: true };
  if (call.method === API_METHOD.PUT && call.path === "/admin/payment-methods/bank-transfer") return { data: rawPaymentMethod("bank-transfer", "active"), ok: true };
  if (call.method === API_METHOD.GET && call.path === "/admin/shipping/providers") return { data: [rawShippingProvider()], ok: true };
  if (call.method === API_METHOD.PUT && call.path.startsWith("/admin/shipping/providers/")) return { data: rawShippingProvider(), ok: true };
  if (call.method === API_METHOD.GET && call.path === "/admin/pickup-points") return { data: [rawPickupPoint()], ok: true };
  if (call.method === API_METHOD.PUT && call.path.startsWith("/admin/pickup-points/")) return { data: rawPickupPoint(), ok: true };
  if (call.method === API_METHOD.GET && call.path === "/admin/discounts/coupons") return { data: [rawCoupon()], ok: true };
  if (call.method === API_METHOD.POST && call.path === "/admin/discounts/coupons") return { data: rawCoupon({ code: "HARNESS10", id: "coupon-created" }), ok: true };
  if (call.method === API_METHOD.PUT && call.path.startsWith("/admin/discounts/coupons/")) return { data: rawCoupon(), ok: true };
  if (call.method === API_METHOD.GET && call.path === "/admin/discounts/shipping") return { data: [rawShippingDiscount()], ok: true };
  if (call.method === API_METHOD.POST && call.path === "/admin/discounts/shipping") return { data: rawShippingDiscount({ id: "shipping-discount-created" }), ok: true };
  if (call.method === API_METHOD.PUT && call.path.startsWith("/admin/discounts/shipping/")) return { data: rawShippingDiscount(), ok: true };
  if (call.method === API_METHOD.DELETE) return { ok: true };
  throw new Error(`Unhandled commerce repository harness call: ${call.method} ${call.path}`);
}

function rawPaymentMethods(): Record<string, unknown>[] {
  return PAYMENT_PROVIDER_IDS.map((id) => rawPaymentMethod(id, id === "bank-transfer" ? "active" : "inactive"));
}

function rawPaymentMethod(id: PaymentProviderId, status: "active" | "inactive"): Record<string, unknown> {
  return {
    acceptedMethods: ["Transferencia bancaria"],
    ...(id === "bank-transfer" ? { bankConfig: bankConfig() } : { bankConfig: { leaked: "must not map" } }),
    description: `${id} API description`,
    id,
    logoSrc: `/${id}.svg`,
    name: `${id} API`,
    options: [{ fee: "0%", id: `${id}-option`, receiveIn: "Now", salesIn: "Now" }],
    selectedOptionId: `${id}-option`,
    status,
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function rawShippingProvider(): Record<string, unknown> {
  return {
    enabledModalities: ["home_delivery"],
    freeShippingThreshold: 50000,
    id: "andreani",
    name: "Andreani API",
    origin: { city: "Buenos Aires", email: "shipping@example.test", number: "123", phone: "+54 11 5555-5555", postalCode: "C1000", province: "Buenos Aires", senderName: "EntrenAR", street: "Test Street" },
    status: "active",
    updatedAt: "2026-08-31T00:00:00.000Z",
    weightRanges: [
      { cost: 7500, id: "range-up-to-1kg", maxGrams: 1000, minGrams: 0 },
      { cost: 10500, id: "range-1kg-to-3kg", maxGrams: 3000, minGrams: 1000 },
      { cost: 15000, id: "range-3kg-to-5kg", maxGrams: 5000, minGrams: 3000 },
      { cost: 22000, id: "range-5kg-to-10kg", maxGrams: 10000, minGrams: 5000 },
      { cost: 30000, id: "range-over-10kg", maxWeightGrams: null, minGrams: 10000 },
    ],
  };
}

function rawPickupPoint(): Record<string, unknown> {
  return {
    address: { city: "Buenos Aires", number: "456", postalCode: "C1001", province: "Buenos Aires", street: "Pickup Street" },
    contactEmail: "pickup@example.test",
    contactName: "Pickup Admin",
    contactPhone: "+54 11 5555-6666",
    costType: "fixed",
    coverageType: "provinces",
    fixedCost: 1200,
    id: "pickup-api",
    isMain: true,
    name: "API Pickup",
    preparationHours: 24,
    provinces: ["Buenos Aires"],
    schedule: [{ day: "monday", from: "09:00", id: "schedule-api", to: "17:00" }],
    status: "active",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function rawCoupon(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    code: "WELCOME10",
    createdAt: "2026-08-31T00:00:00.000Z",
    customerLimitType: "unlimited",
    dateLimitType: "unlimited",
    discountType: "percentage",
    discountValue: 10,
    history: [{ action: "created", createdAt: "2026-08-31T00:00:00.000Z", id: "history-api", label: "Coupon created", userName: "Admin API" }],
    id: "coupon-api",
    includeShippingCost: false,
    maxDiscountType: "none",
    minimumCartAmount: 0,
    productIds: [],
    status: "active",
    targetType: "all_store",
    totalUsageLimitType: "unlimited",
    updatedAt: "2026-08-31T00:00:00.000Z",
    usageCount: 0,
    ...overrides,
  };
}

function rawShippingDiscount(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    createdAt: "2026-08-31T00:00:00.000Z",
    id: "shipping-discount-api",
    minimumCartAmount: 0,
    onlyCheapestShippingMethod: true,
    shippingMethodIds: ["andreani"],
    status: "active",
    targetType: "all_store",
    updatedAt: "2026-08-31T00:00:00.000Z",
    zoneIds: [],
    zoneTargetType: "all",
    ...overrides,
  };
}

function bankConfig(): BankTransferConfig {
  return { alias: "ENTRENAR.API", bankName: "Banco API", cbuCvu: "0000000000000000000000", cuitCuil: "20-00000000-0", holderName: "EntrenAR API" };
}

function couponInput(): CouponFormValues & CreateCouponDTO {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    code: " harness10 ",
    customerLimitType: "unlimited",
    dateLimitType: "unlimited",
    discountType: "percentage",
    discountValue: 10,
    includeShippingCost: false,
    maxDiscountType: "none",
    minimumCartAmount: 0,
    productIds: [],
    status: "active",
    targetType: "all_store",
    totalUsageLimitType: "unlimited",
  };
}

function shippingDiscountInput(): ShippingDiscountFormValues & CreateShippingDiscountDTO {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    minimumCartAmount: 0,
    onlyCheapestShippingMethod: true,
    shippingMethodIds: ["andreani"],
    status: "active",
    targetType: "all_store",
    zoneIds: [],
    zoneTargetType: "all",
  };
}

function findCall(calls: readonly ClientCall[], method: ApiMethod, path: string): ClientCall | undefined {
  return calls.find((call) => call.method === method && call.path === path);
}

function fetchCall(input: RequestInfo | URL, init?: RequestInit): FetchCall {
  const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return { authorization: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET", path: new URL(inputUrl).pathname.replace(/^\/api\/v1/, "") };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolveResponse, rejectResponse) => {
    resolvePromise = resolveResponse;
    rejectPromise = rejectResponse;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

interface ClientCall {
  body?: unknown;
  method: ApiMethod;
  options?: CommerceApiMethodOptions | CommerceApiRequestOptions;
  path: string;
}

interface FetchCall {
  authorization: string | null;
  method: string;
  path: string;
}

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
