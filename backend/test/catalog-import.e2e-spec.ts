import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MutationGate } from "../src/common/prisma/mutation-gate";
import { PrismaCatalogImportRepository } from "../src/modules/catalog-import/catalog-import.repository";
import { CatalogImportService } from "../src/modules/catalog-import/catalog-import.service";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("catalog import persistence boundary", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const suffix = randomUUID().slice(0, 8);
  const slug = `import-e2e-${suffix}`;
  const categorySlug = `import-category-${suffix}`;
  const storageKey = `products/${slug}/1.webp`;
  const manifest = {
    products: [{
      slug,
      name: "Imported E2E product",
      price: 8000,
      compareAtPrice: 10000,
      variantProperties: [],
      categorySlugs: [categorySlug],
      images: [{ position: 1, storageKey, alt: "Imported product" }],
      variants: [{ sku: `IMPORT-${suffix}`, stockMode: "TRACKED", quantity: 4, attributes: {} }],
      tags: [],
      shippingRequired: true,
    }],
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for catalog import E2E tests.");
    await prisma.category.create({ data: { id: `cat-${suffix}`, name: "Import E2E", slug: categorySlug, visibility: "VISIBLE", sortOrder: 999 } });
  });

  afterAll(async () => {
    await prisma.productCategory.deleteMany({ where: { product: { slug } } });
    await prisma.product.deleteMany({ where: { slug } });
    await prisma.category.deleteMany({ where: { slug: categorySlug } });
    await prisma.$disconnect();
  });

  it("imports once, rejects a second import, and exposes canonical rows immediately", async () => {
    const service = createService();
    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: true, counts: { products: 1, variants: 1, images: 1 } });
    await expect(service.importCatalog(manifest)).resolves.toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "PRODUCT_SLUG_CONFLICT" })]) });
    await expect(prisma.product.findUnique({ where: { slug }, include: { images: true, variants: true, categories: true } })).resolves.toEqual(expect.objectContaining({
      price: expect.anything(),
      images: [expect.objectContaining({ storageKey })],
      variants: [expect.objectContaining({ quantity: 4, sku: `IMPORT-${suffix}` })],
      categories: [expect.objectContaining({ categoryId: `cat-${suffix}` })],
    }));
  });

  it("rolls back all catalog rows when a persistence trigger fails", async () => {
    const failureFunction = `catalog_import_fail_${suffix}`;
    const failureTrigger = `catalog_import_fail_trigger_${suffix}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${failureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'catalog import test failure'; END; $$;`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${failureTrigger}" BEFORE INSERT ON "ProductImage" FOR EACH ROW EXECUTE FUNCTION "${failureFunction}"();`);
    try {
      const rollbackSlug = `${slug}-rollback`;
      const rollbackManifest = { ...manifest, products: [{ ...manifest.products[0]!, slug: rollbackSlug, variants: [{ ...manifest.products[0]!.variants[0]!, sku: `IMPORT-ROLLBACK-${suffix}` }], images: [{ ...manifest.products[0]!.images[0]!, storageKey: `products/${rollbackSlug}/1.webp` }] }] };
      await expect(createService().importCatalog(rollbackManifest)).resolves.toMatchObject({ ok: false, issues: [{ code: "PERSISTENCE_FAILURE" }] });
      await expect(prisma.product.findUnique({ where: { slug: rollbackSlug } })).resolves.toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER "${failureTrigger}" ON "ProductImage";`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${failureFunction}"();`);
    }
  });

  function createService(): CatalogImportService {
    return new CatalogImportService(
      new PrismaCatalogImportRepository(prisma as unknown as PrismaService, new MutationGate()),
      { exists: async () => true },
    );
  }
});
