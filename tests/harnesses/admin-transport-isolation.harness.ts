import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AdminApiClient } from "@/lib/api/admin/client";
import { clearAdminAccessToken, setAdminAccessToken } from "@/lib/api/admin/auth/admin-access-token";

const transportFiles = [
  "src/lib/api/admin/sales/client.ts",
  "src/lib/api/admin/customers/client.ts",
  "src/lib/api/admin/statistics/client.ts",
  "src/lib/api/admin/abandoned-carts/client.ts",
  "src/lib/api/commerce/client.ts",
  "src/lib/api/catalog/client.ts",
];

async function run(): Promise<void> {
  for (const file of transportFiles) {
    const source = await readFile(resolve(process.cwd(), file), "utf8");
    assert(!source.includes("accountAccessToken") && !source.includes("/account/"), `${file} still references customer auth.`);
  }

  let refreshCalls = 0;
  setAdminAccessToken("admin-harness-token");
  const client = new AdminApiClient(async (_input, init) => {
    if (init?.method === "POST") refreshCalls += 1;
    return new Response(JSON.stringify({ ok: false, code: "FORBIDDEN", message: "Forbidden" }), { status: 403 });
  }, "https://admin.test/api/v1");
  try {
    await client.get("/admin/protected");
    throw new Error("Expected 403 to fail.");
  } catch (error) {
    assert(error instanceof Error && "status" in error && error.status === 403, "403 was not preserved as a controlled admin error.");
  }
  assert(refreshCalls === 0, "403 incorrectly triggered admin refresh.");
  clearAdminAccessToken();
  console.log("admin transport isolation harness: six transports, admin-token-only boundary, controlled 403 and no refresh passed");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
