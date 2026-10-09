import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalize, CatalogCutoverRepository, compareForeignKeys, hashCanonical, parseSchemaForeignKeys, SNAPSHOT_MODELS, SNAPSHOT_PAGE_SIZE } from "./catalog-cutover.repository";
import { classifyOwnerAttestedPopulation } from "./fixture-provenance";
import type { CatalogSnapshot, SnapshotRecord } from "./cutover-contracts";
import type { PrismaService } from "../../common/prisma/prisma.service";

describe("catalog cutover snapshot contract", () => {
  it("enumerates every Prisma model, including preservation-only configuration and identities", async () => {
    const names = SNAPSHOT_MODELS.map(({ name }) => name);
    const schema = await readFile(resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
    const schemaNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]!).sort();

    expect(names.sort()).toEqual(schemaNames);
    expect(names).toContain("Product");
    expect(names).toContain("InventoryHistory");
    expect(names).toContain("User");
    expect(names).toContain("PaymentMethodConfig");
    expect(names).toContain("ShippingDiscountCategory");
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses stable 500-row pages and declares composite keys explicitly", () => {
    expect(SNAPSHOT_PAGE_SIZE).toBe(500);
    expect(SNAPSHOT_MODELS.find(({ name }) => name === "ProductCategory")?.primaryKey).toEqual(["productId", "categoryId"]);
    expect(SNAPSHOT_MODELS.find(({ name }) => name === "WishlistItem")?.primaryKey).toEqual(["userId", "productId"]);
    expect(SNAPSHOT_MODELS.find(({ name }) => name === "CouponProduct")?.primaryKey).toEqual(["couponId", "productId"]);
  });

  it("compares database delete effects against explicit Prisma schema relations", () => {
    const schema = `model Product {\n  variants ProductVariant[]\n}\nmodel ProductVariant {\n  id String @id\n  productId String\n  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)\n}`;
    const expected = parseSchemaForeignKeys(schema);

    expect(expected).toEqual([{
      constraint: "ProductVariant.productId", fromModel: "ProductVariant", fromFields: ["productId"],
      toModel: "Product", toFields: ["id"], deleteEffect: "Cascade",
    }]);
    expect(compareForeignKeys(expected, expected)).toEqual([]);
    expect(compareForeignKeys(expected, [{ ...expected[0]!, deleteEffect: "Restrict" }])).toEqual([
      "SCHEMA_FOREIGN_KEY_MISSING", "UNMODELED_FOREIGN_KEY_EFFECT",
    ]);
  });

  it("scans disconnected rows in repeatable-read 500-row pages and verifies model counts", async () => {
    const products = Array.from({ length: 501 }, (_, index) => ({ id: `disconnected-${String(index).padStart(3, "0")}`, name: `Product ${index}` }));
    const preservedConfiguration = [{ id: "singleton", showOutOfStockAtEnd: true }];
    const rowsByModel = new Map<string, readonly Record<string, unknown>[]>();
    rowsByModel.set("Product", products);
    rowsByModel.set("CatalogSettings", preservedConfiguration);
    const harness = await createSnapshotHarness(rowsByModel);
    const repository = new CatalogCutoverRepository(harness.prisma, TEST_HMAC_KEY, TEST_TARGET_FINGERPRINT);

    const snapshot = await repository.readSnapshot();

    expect(snapshot.counts["Product"]).toBe(501);
    expect(snapshot.records.filter(({ model }) => model === "Product")).toHaveLength(501);
    expect(snapshot.records.some(({ row }) => row["id"] === "disconnected-500")).toBe(true);
    expect(snapshot.counts["CatalogSettings"]).toBe(1);
    expect(snapshot.records.find(({ model }) => model === "CatalogSettings")?.rowDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(harness.pages.get("Product")).toEqual([
      { cursor: undefined, rowCount: SNAPSHOT_PAGE_SIZE },
      { cursor: ["disconnected-499"], rowCount: 1 },
    ]);
    expect(snapshot.blockers).toEqual([]);
  });

  it("pages composite primary keys lexicographically across the 500-row boundary", async () => {
    const links = Array.from({ length: 501 }, (_, index) => ({
      productId: `product-${String(index).padStart(3, "0")}`,
      categoryId: `category-${String(index).padStart(3, "0")}`,
    }));
    const harness = await createSnapshotHarness(new Map([["ProductCategory", links]]));
    const snapshot = await new CatalogCutoverRepository(harness.prisma, TEST_HMAC_KEY, TEST_TARGET_FINGERPRINT).readSnapshot();

    expect(snapshot.records.filter(({ model }) => model === "ProductCategory")).toHaveLength(501);
    expect(harness.pages.get("ProductCategory")).toEqual([
      { cursor: undefined, rowCount: SNAPSHOT_PAGE_SIZE },
      { cursor: ["product-499", "category-499"], rowCount: 1 },
    ]);
  });

  it("reports a count mismatch rather than silently accepting incomplete enumeration", async () => {
    const products = Array.from({ length: 3 }, (_, index) => ({ id: `product-${index}` }));
    const harness = await createSnapshotHarness(new Map([["Product", products]]), { Product: 4 });
    const snapshot = await new CatalogCutoverRepository(harness.prisma, TEST_HMAC_KEY, TEST_TARGET_FINGERPRINT).readSnapshot();

    expect(snapshot.counts["Product"]).toBe(3);
    expect(snapshot.records.filter(({ model }) => model === "Product")).toHaveLength(3);
    expect(snapshot.blockers).toContain("SNAPSHOT_COUNT_MISMATCH:Product");
  });

  it("canonicalizes object key order without changing array order", () => {
    expect(canonicalize({ b: [2, 1], a: { y: 1, x: 2 } })).toEqual({ a: { x: 2, y: 1 }, b: [2, 1] });
    expect(hashCanonical({ b: 2, a: 1 })).toBe(hashCanonical({ a: 1, b: 2 }));
    expect(hashCanonical([1, 2])).not.toBe(hashCanonical([2, 1]));
  });

  it("classifies owner-attested candidates without requiring matching fixture manifests or granting approval", () => {
    const product = record("Product", "product-ref", { id: "p1" });
    const customer = record("Customer", "customer-ref", { id: "c1", userId: null });
    const address = record("CustomerAddress", "address-ref", { id: "a1", customerId: "c1" });
    const customerUser = record("User", "customer-user-ref", { id: "u1", role: "CUSTOMER" });
    const admin = record("User", "admin-ref", { id: "admin", role: "ADMIN" });
    const adminAddress = record("UserAddress", "admin-address-ref", { id: "aa", userId: "admin" });
    const snapshot = makeSnapshot([product, customer, address, customerUser, admin, adminAddress], [
      { constraint: "CustomerAddress_customerId_fkey", fromModel: "CustomerAddress", fromFields: ["customerId"], toModel: "Customer", toFields: ["id"], deleteEffect: "Cascade" },
      { constraint: "UserAddress_userId_fkey", fromModel: "UserAddress", fromFields: ["userId"], toModel: "User", toFields: ["id"], deleteEffect: "Cascade" },
    ]);

    const result = classifyOwnerAttestedPopulation(snapshot, {
      owner: "catalog owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: "Existing local commercial data is mock.", prdDigest: "a".repeat(64),
    });

    expect(result.rows.find(({ ref }) => ref === product.ref)?.classification).toBe("mock");
    expect(result.rows.find(({ ref }) => ref === admin.ref)?.classification).toBe("preserved");
    expect(result.selectors.get(address.ref)).toMatchObject({ customerId: "c1" });
    expect(result.selectors.has(adminAddress.ref)).toBe(false);
    expect(result.blockers).toEqual([]);
    expect("approval" in result).toBe(false);
  });

  it("includes disconnected attested records and missing historical fixture targets without broadening preserved scope", () => {
    const key = record("CheckoutIdempotencyKey", "key-ref", { id: "old-key" });
    const inventory = record("InventoryHistory", "history-ref", { id: "old-history", referenceType: "ORDER", referenceId: "absent-order", inventoryEffectId: "absent-effect" });
    const item = record("OrderItem", "item-ref", { id: "old-item", productId: "absent-product", variantId: "absent-variant" });
    const reconciliation = record("InventoryHistory", "reconciliation-ref", { id: "old-reconciliation", referenceType: "RECONCILIATION", referenceId: "operation-label" });
    const settings = record("CatalogSettings", "settings-ref", { id: "settings" });
    const result = classifyOwnerAttestedPopulation(makeSnapshot([key, inventory, item, reconciliation, settings]), {
      owner: "catalog owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: "Existing local commercial data is mock.", prdDigest: "e".repeat(64),
    });
    expect(result.blockers).toEqual([]);
    expect(result.rows.filter(({ classification }) => classification === "mock").map(({ ref }) => ref)).toEqual([key.ref, inventory.ref, item.ref, reconciliation.ref]);
    expect(result.rows.find(({ ref }) => ref === settings.ref)?.classification).toBe("preserved");
    expect(result.selectors.has(settings.ref)).toBe(false);
  });

  it("blocks malformed or unresolved typed snapshot references without rejecting owner classification", () => {
    const session = record("CheckoutSession", "session-ref", { id: "session", snapshotData: { items: [{ productId: "absent" }] } });
    const malformed = record("CheckoutSession", "malformed-session-ref", { id: "malformed", snapshotData: { items: "not-an-array" } });
    const result = classifyOwnerAttestedPopulation(makeSnapshot([session, malformed]), {
      owner: "catalog owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: "Existing local commercial data is mock.", prdDigest: "b".repeat(64),
    });

    expect(result.rows.find(({ ref }) => ref === session.ref)?.classification).toBe("mock");
    expect(result.blockers).toContain("UNRESOLVED_JSON_REFERENCE");
    expect(result.blockers).toContain("MALFORMED_SNAPSHOT_ITEMS");
  });

  it("blocks commercial customer records attached to preserved administrator identities", () => {
    const admin = record("User", "admin-ref", { id: "admin", role: "ADMIN" });
    const customer = record("Customer", "customer-ref", { id: "customer", userId: "admin" });
    const result = classifyOwnerAttestedPopulation(makeSnapshot([admin, customer], [
      { constraint: "Customer_userId_fkey", fromModel: "Customer", fromFields: ["userId"], toModel: "User", toFields: ["id"], deleteEffect: "SetNull" },
    ]), {
      owner: "catalog owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: "Existing local commercial data is mock.", prdDigest: "c".repeat(64),
    });

    expect(result.rows.find(({ ref }) => ref === admin.ref)?.classification).toBe("preserved");
    expect(result.rows.find(({ ref }) => ref === customer.ref)?.classification).toBe("mock");
    expect(result.rows.find(({ ref }) => ref === customer.ref)?.blockers).toContain("MIXED_AUTHENTICATION_OWNERSHIP");
    expect(result.blockers).toContain("MIXED_AUTHENTICATION_OWNERSHIP");
  });

  it("blocks deleting a customer owner with a preserved admin session independently of FK extraction", () => {
    const customer = record("User", "customer-user-ref", { id: "customer-user", role: "CUSTOMER" });
    const adminSession = record("RefreshToken", "admin-session-ref", { id: "admin-session", userId: "customer-user", sessionType: "ADMIN" });
    const result = classifyOwnerAttestedPopulation(makeSnapshot([customer, adminSession]), {
      owner: "catalog owner", confirmedAt: "2026-10-01T00:00:00.000Z", statement: "Existing local commercial data is mock.", prdDigest: "d".repeat(64),
    });

    expect(result.rows.find(({ ref }) => ref === customer.ref)?.classification).toBe("mock");
    expect(result.rows.find(({ ref }) => ref === adminSession.ref)?.classification).toBe("preserved");
    expect(result.rows.find(({ ref }) => ref === customer.ref)?.blockers).toContain("OUT_OF_SCOPE_DELETE_EFFECT");
    expect(result.rows.find(({ ref }) => ref === adminSession.ref)?.blockers).toContain("OUT_OF_SCOPE_DELETE_EFFECT");
    expect(result.blockers).toContain("OUT_OF_SCOPE_DELETE_EFFECT");
  });
});

function record(model: string, ref: string, row: Record<string, unknown>): SnapshotRecord {
  return { model, ref, rowDigest: "digest", row };
}

function makeSnapshot(records: SnapshotRecord[], foreignKeys: CatalogSnapshot["foreignKeys"] = []): CatalogSnapshot {
  return {
    snapshotId: "audit-id", targetFingerprint: "fingerprint", schema: "public", populationDigest: "population",
    counts: {}, records, foreignKeys, blockers: [],
  };
}

const TEST_HMAC_KEY = "evidence-hmac-secret-that-is-long-enough";
const TEST_TARGET_FINGERPRINT = () => "a".repeat(64);

async function createSnapshotHarness(
  rowsByModel: ReadonlyMap<string, readonly Record<string, unknown>[]>,
  countOverrides: Readonly<Record<string, number>> = {},
): Promise<{ prisma: PrismaService; pages: Map<string, Array<{ cursor: readonly unknown[] | undefined; rowCount: number }>> }> {
  const schema = await readFile(resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
  const schemaForeignKeys = parseSchemaForeignKeys(schema);
  const pages = new Map<string, Array<{ cursor: readonly unknown[] | undefined; rowCount: number }>>();
  const transaction = {
    $queryRaw: async (query: { sql: string; values?: readonly unknown[] }) => {
      if (query.sql.includes("count(*)")) {
        const model = /FROM "([A-Za-z]+)"/.exec(query.sql)?.[1]!;
        const actual = rowsByModel.get(model)?.length ?? 0;
        return [{ count: BigInt(countOverrides[model] ?? actual) }];
      }
      if (query.sql.includes("pg_constraint")) {
        return schemaForeignKeys.flatMap((foreignKey) => foreignKey.fromFields.map((fromField, index) => ({
          constraint: foreignKey.constraint, fromModel: foreignKey.fromModel, fromField,
          toModel: foreignKey.toModel, toField: foreignKey.toFields[index],
          deleteEffect: ({ Cascade: "c", Restrict: "r", SetNull: "n", NoAction: "a" } as const)[foreignKey.deleteEffect as "Cascade" | "Restrict" | "SetNull" | "NoAction"],
          position: index + 1,
        })));
      }
      const model = /FROM "([A-Za-z]+)" AS page_row/.exec(query.sql)?.[1]!;
      const definition = SNAPSHOT_MODELS.find((entry) => entry.name === model)!;
      const cursor = query.sql.includes("WHERE") ? query.values?.slice(0, definition.primaryKey.length) : undefined;
      const ordered = [...(rowsByModel.get(model) ?? [])].sort((left, right) => compareCompositeKey(left, right, definition.primaryKey));
      const candidates = cursor
        ? ordered.filter((row) => compareCompositeKeyToCursor(row, cursor, definition.primaryKey) > 0)
        : ordered;
      const page = candidates.slice(0, SNAPSHOT_PAGE_SIZE);
      const observations = pages.get(model) ?? [];
      observations.push({ cursor, rowCount: page.length });
      pages.set(model, observations);
      return page.map((row) => ({ row }));
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => Promise<unknown>, options: { isolationLevel: string }) => {
      expect(options.isolationLevel).toBe("RepeatableRead");
      return callback(transaction);
    },
  } as unknown as PrismaService;
  return { prisma, pages };
}

function compareCompositeKey(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>, fields: readonly string[]): number {
  for (const field of fields) {
    const comparison = String(left[field]).localeCompare(String(right[field]));
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareCompositeKeyToCursor(row: Readonly<Record<string, unknown>>, cursor: readonly unknown[], fields: readonly string[]): number {
  for (const [index, field] of fields.entries()) {
    const comparison = String(row[field]).localeCompare(String(cursor[index]));
    if (comparison !== 0) return comparison;
  }
  return 0;
}
