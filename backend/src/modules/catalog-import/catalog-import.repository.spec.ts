import { MutationGate } from "../../common/prisma/mutation-gate";
import { PrismaService } from "../../common/prisma/prisma.service";
import { normalizeCatalogImportManifest } from "./manifest-validator";
import { PrismaCatalogImportRepository } from "./catalog-import.repository";
import type { CatalogImportPlan } from "./manifest-validator";

const manifest = {
  products: [{
    slug: "whey-pro", publicSlug: "whey-pro", name: "Whey Pro", price: 8000, weightGrams: 1000,
    categorySlugs: ["protein"], variantProperties: [], tags: [], shippingRequired: true,
    images: [{ position: 1, storageKey: "products/whey-pro/1.webp" }],
    variants: [{ sku: "WHEY-001", name: "Simple", attributes: {}, stockMode: "TRACKED", quantity: 2 }],
  }],
};

describe("PrismaCatalogImportRepository read-only reconciliation", () => {
  it("matches exact committed product, variant, image, and category-link rows", async () => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([{ slug: "whey-pro", publicSlug: "whey-pro" }]) },
      productVariant: { findMany: jest.fn().mockResolvedValue([{ sku: "WHEY-001", product: { slug: "whey-pro" } }]) },
      productImage: { findMany: jest.fn().mockResolvedValue([{ storageKey: "products/whey-pro/1.webp", position: 1, product: { slug: "whey-pro" } }]) },
      productCategory: { findMany: jest.fn().mockResolvedValue([{ product: { slug: "whey-pro" }, category: { slug: "protein" } }]) },
    };
    const repository = new PrismaCatalogImportRepository(prisma as unknown as PrismaService, {} as MutationGate);

    await expect(repository.reconcile(normalizeCatalogImportManifest(manifest))).resolves.toEqual({
      matches: true,
      mismatches: [],
      counts: { products: 1, variants: 1, images: 1, categoryLinks: 1 },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({ select: { slug: true, publicSlug: true } });
    expect(prisma.productVariant.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productImage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productCategory.findMany).toHaveBeenCalledTimes(1);
  });

  it("reports mismatched rows without attempting repair", async () => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([{ slug: "other", publicSlug: "other" }]) },
      productVariant: { findMany: jest.fn().mockResolvedValue([]) },
      productImage: { findMany: jest.fn().mockResolvedValue([]) },
      productCategory: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new PrismaCatalogImportRepository(prisma as unknown as PrismaService, {} as MutationGate);
    const report = await repository.reconcile(normalizeCatalogImportManifest(manifest));

    expect(report.matches).toBe(false);
    expect(report.mismatches).toEqual(expect.arrayContaining([
      "PRODUCT_ROWS_MISMATCH", "VARIANT_ROWS_MISMATCH", "IMAGE_ROWS_MISMATCH", "CATEGORY_LINK_ROWS_MISMATCH",
    ]));
    expect(Object.values(prisma).every((delegate) => Object.values(delegate).every((method) => jest.isMockFunction(method)))).toBe(true);
  });
});

describe("PrismaCatalogImportRepository atomic persistence boundary", () => {
  function persistenceHarness(failVariants = false) {
    const staged: string[] = [];
    const committed: string[] = [];
    const transaction = {
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        createManyAndReturn: jest.fn().mockImplementation(async () => { staged.push("products"); return [{ id: "p1", slug: "whey-pro" }]; }),
      },
      category: { findMany: jest.fn().mockResolvedValue([{ id: "c1", slug: "protein" }]) },
      productImage: { createManyAndReturn: jest.fn().mockImplementation(async () => { staged.push("images"); return [{ id: "i1", productId: "p1", storageKey: "products/whey-pro/1.webp" }]; }) },
      productCategory: { createMany: jest.fn().mockImplementation(async () => { staged.push("categoryLinks"); return { count: 1 }; }) },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation(async () => {
          staged.push("variants");
          if (failVariants) throw new Error("late persistence failure");
        }),
      },
    };
    const gate = {
      runExclusive: jest.fn(async (_prisma: unknown, operation: (tx: typeof transaction) => Promise<unknown>, options: unknown) => {
        expect(options).toEqual({ timeout: 30_000 });
        try {
          const result = await operation(transaction);
          committed.push(...staged);
          return result;
        } catch (error) {
          staged.splice(0, staged.length);
          throw error;
        }
      }),
    };
    return { repository: new PrismaCatalogImportRepository({} as PrismaService, gate as unknown as MutationGate), gate, committed };
  }

  it("persists all catalog row families once under the exclusive gate and reports their counts", async () => {
    const harness = persistenceHarness();
    const plan = normalizeCatalogImportManifest(manifest) as CatalogImportPlan;

    await expect(harness.repository.persist(plan)).resolves.toEqual({ products: 1, variants: 1, images: 1, categoryLinks: 1 });
    expect(harness.gate.runExclusive).toHaveBeenCalledTimes(1);
    expect(harness.committed.sort()).toEqual(["categoryLinks", "images", "products", "variants"]);
  });

  it("propagates a late transaction failure without committing staged catalog rows", async () => {
    const harness = persistenceHarness(true);
    const plan = normalizeCatalogImportManifest(manifest) as CatalogImportPlan;

    await expect(harness.repository.persist(plan)).rejects.toThrow("late persistence failure");
    expect(harness.gate.runExclusive).toHaveBeenCalledTimes(1);
    expect(harness.committed).toEqual([]);
  });
});
