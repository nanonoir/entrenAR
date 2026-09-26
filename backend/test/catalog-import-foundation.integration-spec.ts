import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

describe("catalog import foundation migration", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for foundation integration tests.");
  });

  afterAll(async () => prisma.$disconnect());

  it("preserves universal variants and complete cart references", async () => {
    const [productsWithoutVariants, cartItemsWithoutVariants, orphanImages, duplicateVariantSkus] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "Product" p WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id")`,
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "CartItem" WHERE "variantId" IS NULL`,
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "ProductImage" i WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = i."productId")`,
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM (SELECT "sku" FROM "ProductVariant" GROUP BY "sku" HAVING COUNT(*) > 1) duplicates`,
    ]);

    expect(Number(productsWithoutVariants[0]?.count ?? 0)).toBe(0);
    expect(Number(cartItemsWithoutVariants[0]?.count ?? 0)).toBe(0);
    expect(Number(orphanImages[0]?.count ?? 0)).toBe(0);
    expect(Number(duplicateVariantSkus[0]?.count ?? 0)).toBe(0);
  });

  it("keeps the foundation migration additive", async () => {
    const migration = await readFile(resolve(__dirname, "../prisma/migrations/20260925000000_catalog_import_readiness_foundation/migration.sql"), "utf8");
    expect(migration).toContain('ADD COLUMN "price"');
    expect(migration).toContain('CREATE TABLE "ProductImage"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});
