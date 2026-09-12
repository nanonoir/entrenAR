import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(process.cwd());
const TSX_CLI = resolve(PROJECT_ROOT, "node_modules/tsx/dist/cli.mjs");

const DATA_SOURCE_ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "NEXT_PUBLIC_COMMERCE_DATA_SOURCE",
  "NEXT_PUBLIC_CHECKOUT_DATA_SOURCE",
  "NEXT_PUBLIC_USE_MOCK_ADMIN_SALES",
  "NEXT_PUBLIC_ADMIN_DATA_SOURCE",
  "NEXT_PUBLIC_USE_MOCK_ADMIN_CUSTOMERS",
  "NEXT_PUBLIC_USE_MOCK_ADMIN_ABANDONED_CARTS",
  "NEXT_PUBLIC_USE_MOCK_ADMIN_STATISTICS",
] as const;

const HARNESS_PATHS = [
  "tests/harnesses/admin-mock-boundary.harness.ts",
  "tests/harnesses/shop-mock-boundary.harness.ts",
  "src/lib/api/catalog/catalog-adapter.harness.ts",
  "src/lib/api/account/account-adapter.harness.ts",
  "src/lib/api/checkout/checkout-adapter.harness.ts",
  "src/lib/api/commerce/commerce-adapter.harness.ts",
  "src/lib/api/admin/sales/__tests__/sales-adapter.harness.ts",
  "src/lib/api/admin/customers/__tests__/customers-adapter.harness.ts",
  "src/lib/api/admin/abandoned-carts/__tests__/abandoned-carts-adapter.harness.ts",
  "src/lib/api/admin/statistics/__tests__/statistics-adapter.harness.ts",
  "src/stores/cart-store.harness.ts",
  "src/stores/__tests__/admin-sales-store.harness.ts",
  "src/lib/api/admin/abandoned-carts/__tests__/abandoned-carts-store.harness.ts",
] as const;

async function run(): Promise<void> {
  await assertApiDefaultDataSource();

  for (const harnessPath of HARNESS_PATHS) {
    const output = await runHarness(harnessPath);
    const summary = output.trim().split(/\r?\n/).at(-1) ?? "passed";
    console.log(`frontend acceptance: ${harnessPath} — ${summary}`);
  }

  console.log(`frontend acceptance harness: passed; API default resolution and ${HARNESS_PATHS.length} harnesses verified`);
}

async function assertApiDefaultDataSource(): Promise<void> {
  const originalValues = new Map<string, string | undefined>();

  for (const key of DATA_SOURCE_ENVIRONMENT_KEYS) {
    originalValues.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    const {
      DATA_SOURCE,
      getAccountDataSource,
      getAdminAbandonedCartsDataSource,
      getAdminCustomersDataSource,
      getAdminSalesDataSource,
      getAdminStatisticsDataSource,
      getCatalogDataSource,
      getCheckoutDataSource,
      getCommerceDataSource,
    } = await import("../../src/lib/api/config");
    const sources = [
      getCatalogDataSource(),
      getAccountDataSource(),
      getCheckoutDataSource(),
      getCommerceDataSource(),
      getAdminSalesDataSource(),
      getAdminCustomersDataSource(),
      getAdminAbandonedCartsDataSource(),
      getAdminStatisticsDataSource(),
    ];

    if (sources.some((source) => source !== DATA_SOURCE.API)) {
      throw new Error(`Expected every unset data source to resolve to API; received ${sources.join(", ")}.`);
    }

    console.log("API default data-source resolution: passed");
  } finally {
    for (const key of DATA_SOURCE_ENVIRONMENT_KEYS) {
      const value = originalValues.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function runHarness(harnessPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [TSX_CLI, resolve(PROJECT_ROOT, harnessPath)], {
      cwd: PROJECT_ROOT,
      env: withoutDataSourceEnvironment(),
      maxBuffer: 4 * 1_048_576,
    });

    if (!stdout.trim()) throw new Error("The harness produced no success output.");
    return stdout;
  } catch (error: unknown) {
    throw new Error(`Harness failed: ${harnessPath}\n${errorMessage(error)}`);
  }
}

function withoutDataSourceEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of DATA_SOURCE_ENVIRONMENT_KEYS) delete environment[key];
  return environment;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

void run().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
