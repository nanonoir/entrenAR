import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { classifyOwnerAttestedPopulation } from "../src/modules/catalog-cutover/fixture-provenance";
import { CatalogCutoverRepository, hashCanonical, preservedPopulationDigest, SNAPSHOT_MODELS } from "../src/modules/catalog-cutover/catalog-cutover.repository";
import { identifyDatabaseTarget } from "../src/modules/catalog-scraper/operations/database-target";
import { withScopedLedgerDeletion } from "../src/modules/catalog-cutover/scoped-ledger-deletion";

const scratchUrl = process.env["CATALOG_CUTOVER_TEST_DATABASE_URL"];
const describeDisposable = validateScratchUrl(scratchUrl) ? describe : describe.skip;

describeDisposable("catalog cutover atomic cleanup on disposable scratch PostgreSQL", () => {
  const databaseUrl = scratchUrl!;
  const target = identifyDatabaseTarget(databaseUrl);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const repository = new CatalogCutoverRepository(prisma as unknown as PrismaService, "catalog-cutover-test-hmac-key-that-is-over-32-characters", () => target.fingerprint);

  beforeEach(async () => {
    await clearScratchDatabase();
    await seedCategories(61);
    await prisma.user.create({ data: { id: "preserved-admin", email: "admin@example.test", passwordHash: "fixture-hash", role: "ADMIN" } });
  });

  afterAll(async () => {
    await clearScratchDatabase();
    await prisma.$disconnect();
  });

  it("deletes disconnected commercial rows child-first and preserves categories and admin identity", async () => {
    await seedProductGraph("product-a", "movement-a");
    await seedProductGraph("disconnected-product", "movement-disconnected");
    const before = await repository.readSnapshot();
    const plan = createDeletionPlan(before);

    const receipt = await repository.cleanupApproved(plan);

    expect(receipt.deletedCount).toBeGreaterThan(0);
    await expect(prisma.product.count()).resolves.toBe(0);
    await expect(prisma.category.count()).resolves.toBe(61);
    await expect(prisma.user.findUnique({ where: { id: "preserved-admin" } })).resolves.toMatchObject({ role: "ADMIN" });
    await expect(prisma.inventoryHistory.count()).resolves.toBe(0);
  });

  it("rejects post-audit bypass-writer drift without deleting either population", async () => {
    await seedProductGraph("audited-product", "audited-movement");
    const before = await repository.readSnapshot();
    const plan = createDeletionPlan(before);
    await seedProductGraph("late-product", "late-movement");

    await expect(repository.cleanupApproved(plan)).rejects.toThrow("drifted after approval");
    await expect(prisma.product.count()).resolves.toBe(2);
  });

  it("denies ordinary mutations and restores protection after an exact-row maintenance transaction", async () => {
    await seedProductGraph("product-a", "movement-a");
    await expect(prisma.inventoryHistory.delete({ where: { id: "movement-a-compensation" } })).rejects.toThrow("append-only");
    await expect(prisma.inventoryHistory.update({ where: { id: "movement-a" }, data: { origin: "changed" } })).rejects.toThrow("append-only");
    await prisma.$transaction(async (transaction) => {
      await withScopedLedgerDeletion(transaction, ["movement-a-compensation"], async () => {
        await transaction.inventoryHistory.delete({ where: { id: "movement-a-compensation" } });
      });
    });
    await expect(prisma.inventoryHistory.findUnique({ where: { id: "movement-a-compensation" } })).resolves.toBeNull();
    await expect(prisma.inventoryHistory.delete({ where: { id: "movement-a" } })).rejects.toThrow("append-only");
  });

  it("rejects unapproved ledger rows and UPDATE even inside maintenance, with no transaction leakage", async () => {
    await seedProductGraph("product-a", "movement-a");
    await expect(prisma.$transaction(async (transaction) => {
      await withScopedLedgerDeletion(transaction, ["movement-a"], async () => {
        await transaction.inventoryHistory.delete({ where: { id: "movement-a-compensation" } });
      });
    })).rejects.toThrow("append-only");
    await expect(prisma.$transaction(async (transaction) => {
      await withScopedLedgerDeletion(transaction, ["movement-a"], async () => {
        await transaction.inventoryHistory.update({ where: { id: "movement-a" }, data: { origin: "changed" } });
      });
    })).rejects.toThrow("append-only");
    await expect(prisma.inventoryHistory.count()).resolves.toBe(2);
    await expect(prisma.inventoryHistory.delete({ where: { id: "movement-a-compensation" } })).rejects.toThrow("append-only");
  });

  it("blocks a candidate owner whose deletion cascades into an out-of-scope administrator session", async () => {
    await prisma.user.create({ data: { id: "customer-user", email: "customer@example.test", passwordHash: "fixture-hash", role: "CUSTOMER" } });
    await prisma.refreshToken.create({ data: {
      id: "admin-session", tokenHash: "private-session-hash", userId: "customer-user", sessionType: "ADMIN",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    } });
    const snapshot = await repository.readSnapshot();
    const classified = classifyOwnerAttestedPopulation(snapshot, {
      owner: "disposable database test", confirmedAt: "2026-10-01T00:00:00.000Z",
      statement: "All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required.", prdDigest: "a".repeat(64),
    });
    const customerUserRef = snapshot.records.find(({ model, row }) => model === "User" && row["id"] === "customer-user")?.ref;
    const adminSessionRef = snapshot.records.find(({ model, row }) => model === "RefreshToken" && row["id"] === "admin-session")?.ref;

    expect(snapshot.foreignKeys).toContainEqual(expect.objectContaining({
      fromModel: "RefreshToken", fromFields: ["userId"], toModel: "User", toFields: ["id"], deleteEffect: "Cascade",
    }));
    expect(classified.edges).toContainEqual(expect.objectContaining({
      from: customerUserRef, to: adminSessionRef, field: "userId", kind: "foreign-key", deleteEffect: "Cascade",
    }));
    expect(classified.blockers).toContain("OUT_OF_SCOPE_DELETE_EFFECT");
    expect(classified.rows.find(({ ref }) => ref === customerUserRef)?.classification).toBe("mock");
    expect(classified.rows.find(({ ref }) => ref === adminSessionRef)?.classification).toBe("preserved");
    await expect(prisma.user.findUnique({ where: { id: "customer-user" } })).resolves.not.toBeNull();
  });

  it("rolls back every deletion if canonical-category reconciliation fails", async () => {
    await clearScratchDatabase();
    await seedCategories(60);
    await seedProductGraph("rollback-product", "rollback-movement");
    const before = await repository.readSnapshot();

    await expect(repository.cleanupApproved(createDeletionPlan(before))).rejects.toThrow("reconciliation failed");
    await expect(prisma.product.findUnique({ where: { id: "rollback-product" } })).resolves.not.toBeNull();
  });

  async function seedCategories(count: number): Promise<void> {
    await prisma.category.createMany({
      data: Array.from({ length: count }, (_, index) => ({ id: `category-${index}`, name: `Category ${index}`, slug: `cutover-category-${index}` })),
    });
  }

  async function seedProductGraph(productId: string, movementId: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await transaction.product.create({ data: { id: productId, slug: `${productId}-slug`, publicSlug: `${productId}-public`, name: productId, price: "10.00" } });
      const imageId = `${productId}-image`;
      await transaction.productImage.create({ data: { id: imageId, productId, storageKey: `products/${productId}/1.webp`, position: 1 } });
      const variantId = `${productId}-variant`;
      await transaction.productVariant.create({ data: {
        id: variantId, productId, sku: `${productId}-sku`, name: "Default", stockMode: "TRACKED", quantity: 0, primaryImageId: imageId,
      } });
      await transaction.productCategory.create({ data: { productId, categoryId: "category-0" } });
      await transaction.inventoryHistory.create({ data: {
        id: movementId, productId, variantId, operation: "REPLACE", stockMode: "TRACKED", origin: "cutover-test", operationId: `${movementId}-group`,
      } });
      await transaction.inventoryHistory.create({ data: {
        id: `${movementId}-compensation`, productId, variantId, operation: "REPLACE", stockMode: "TRACKED", origin: "cutover-test",
        operationId: `${movementId}-group`, compensatesMovementId: movementId,
      } });
    });
  }

  function createDeletionPlan(snapshot: Awaited<ReturnType<CatalogCutoverRepository["readSnapshot"]>>) {
    const classified = classifyOwnerAttestedPopulation(snapshot, {
      owner: "disposable database test", confirmedAt: "2026-10-01T00:00:00.000Z",
      statement: "All existing local commercial data is mock by owner attestation; no per-record fixture manifest is required.", prdDigest: "a".repeat(64),
    });
    if (classified.blockers.length > 0) throw new Error(`Scratch fixture produced cutover blockers: ${classified.blockers.join(",")}`);
    const selected = classified.rows.filter(({ classification }) => classification === "mock");
    const rowsByRef = new Map(snapshot.records.map((record) => [record.ref, record]));
    const selectors = selected.map(({ ref, model }) => {
      const record = rowsByRef.get(ref)!;
      const fields = model === "CustomerAddress" ? ["customerId"] : SNAPSHOT_MODELS.find((entry) => entry.name === model)!.primaryKey;
      return { model, ref, fields, values: fields.map((field) => String(record.row[field])) };
    });
    const selectedRefs = new Set(selected.map(({ ref }) => ref));
    return {
      targetFingerprint: snapshot.targetFingerprint, populationDigest: snapshot.populationDigest,
      foreignKeyDigest: hashCanonical(snapshot.foreignKeys), selectedRefs: [...selectedRefs], selectors, edges: classified.edges,
      preservedDigest: preservedPopulationDigest(snapshot.records.filter(({ ref }) => !selectedRefs.has(ref))),
    };
  }

  async function clearScratchDatabase(): Promise<void> {
    const tables = SNAPSHOT_MODELS.map(({ name }) => `"${name}"`).join(", ");
    await prisma.$executeRaw(Prisma.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`));
  }
});

function validateScratchUrl(value: string | undefined): boolean {
  if (!value) return false;
  const identity = identifyDatabaseTarget(value);
  if (identity.host !== "127.0.0.1" || identity.port !== 5432 || identity.database !== "entrenar_catalog_cutover_scratch" || identity.schema !== "public") {
    throw new Error("Catalog cutover integration tests require exactly 127.0.0.1:5432/entrenar_catalog_cutover_scratch/public.");
  }
  return true;
}
