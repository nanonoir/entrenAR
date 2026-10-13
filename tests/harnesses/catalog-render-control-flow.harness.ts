import assert from "node:assert/strict";
import { CatalogApiRepository } from "../../src/lib/api/catalog/catalog-api.repository";
import { CatalogApiError, FetchCatalogApiClient } from "../../src/lib/api/catalog/client";

async function main() {
  const originalFetch = globalThis.fetch;
  const signal = Object.assign(new Error("Synthetic Next request-time rendering signal"), { digest: "DYNAMIC_SERVER_USAGE" });
  const client = new FetchCatalogApiClient();
  try {
    globalThis.fetch = async () => { throw signal; };
    await assert.rejects(client.get("/products"), (error: unknown) => error === signal);
    const repository = new CatalogApiRepository({ get: async () => { throw signal; } });
    for (const read of [
      () => repository.getPublicProducts(),
      () => repository.getPublicCategories(),
      () => repository.getPublicProductBySlug("synthetic"),
      () => repository.getPublicListing({ page: 1, limit: 20 }),
      () => repository.getPublicBrands(),
    ]) await assert.rejects(read(), (error: unknown) => error === signal);

    // Real transport failures still become controlled errors, never empty success.
    globalThis.fetch = async () => { throw new TypeError("Synthetic network failure"); };
    await assert.rejects(client.get("/products"), (error: unknown) => error instanceof CatalogApiError && error.code === "CATALOG_API_UNAVAILABLE" && error.status === 503);
    const unavailable = new CatalogApiRepository(client);
    const result = await unavailable.getPublicProducts();
    assert.equal(result.status, "error");
    if (result.status === "error") assert.equal(result.error.code, "CATALOG_API_UNAVAILABLE");
    else assert.fail("Transport failure must remain an error");
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("catalog render control flow: passed; Next signals propagate and runtime transport failures remain errors");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
