import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { MutationGate } from "../../common/prisma/mutation-gate";
import { PrismaCatalogImportRepository } from "../catalog-import/catalog-import.repository";
import { CatalogImportService } from "../catalog-import/catalog-import.service";
import { normalizeCatalogImportManifest, type CatalogImportPlan } from "../catalog-import/manifest-validator";
import type { PrismaService } from "../../common/prisma/prisma.service";

const PRODUCT_COUNT = 657;
const VARIANT_COUNT = 1_131;
const IMAGE_COUNT = 3_869;
const LINK_COUNT = 804;
const RUN_COUNT = 5;

interface BenchmarkRun { run: number; durationMs: number; products: number; variants: number; images: number; links: number; queryCount: number }

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL_E2E"];
  if (!databaseUrl) throw new Error("DATABASE_URL_E2E is required; application DATABASE_URL is never used.");
  const outputPath = resolve(process.argv[2] ?? "openspec/reports/prd2-importer-benchmark-rerun.json");
  let queryCount = 0;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }), log: [{ emit: "event", level: "query" }] });
  prisma.$on("query", () => { queryCount += 1; });
  const repository = new PrismaCatalogImportRepository(prisma as unknown as PrismaService, new MutationGate());
  const service = new CatalogImportService(repository, { exists: async () => true });
  const manifest = createManifest();
  try {
    await seedCategories(prisma);
    const runs: BenchmarkRun[] = [];
    for (let run = 1; run <= RUN_COUNT; run += 1) {
      await resetProducts(prisma);
      queryCount = 0;
      const started = performance.now();
      const result = await service.importCatalog(manifest);
      const durationMs = performance.now() - started;
      if (!result.ok) throw new Error(`Benchmark run ${run} failed.`);
      runs.push({ run, durationMs, ...await counts(prisma), queryCount });
    }
    await resetProducts(prisma);
    const rollback = await runRollback(repository, manifest, prisma);
    await resetProducts(prisma);
    const report = {
      dataset: { products: PRODUCT_COUNT, variants: VARIANT_COUNT, images: IMAGE_COUNT, links: LINK_COUNT },
      runs,
      maxDurationMs: Math.max(...runs.map((run) => run.durationMs)),
      meanDurationMs: runs.reduce((total, run) => total + run.durationMs, 0) / runs.length,
      batching: { categoryResolution: 1, productInsert: 1, imageInsert: 1, linkInsert: 1, variantInsert: 1, expectedPersistenceStatements: 5 },
      rollback,
      cleanup: { products: (await counts(prisma)).products, categories: await prisma.category.count() },
      applicationDatabaseTouched: false,
    };
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ outputPath, maxDurationMs: report.maxDurationMs, meanDurationMs: report.meanDurationMs, rollback: report.rollback, cleanup: report.cleanup })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

function createManifest(): unknown {
  return { products: Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const slug = `benchmark-product-${String(index + 1).padStart(4, "0")}`;
    const hasSecondVariant = index < VARIANT_COUNT - PRODUCT_COUNT;
    const imageTotal = index < IMAGE_COUNT - PRODUCT_COUNT * 5 ? 6 : 5;
    const variants = [{ sku: `BENCH-${index + 1}-A`, attributes: hasSecondVariant ? { size: "small" } : {}, stockMode: "TRACKED", quantity: 2 }];
    if (hasSecondVariant) variants.push({ sku: `BENCH-${index + 1}-B`, attributes: { size: "large" }, stockMode: "TRACKED", quantity: 2 });
    return {
      slug, publicSlug: slug, name: `Benchmark Product ${index + 1}`, descriptionHtml: "<p>Benchmark fixture</p>", price: 100,
      variantProperties: hasSecondVariant ? [{ id: "size", name: "Size", values: [{ id: "small", label: "Small" }, { id: "large", label: "Large" }] }] : [],
      categorySlugs: index < LINK_COUNT - PRODUCT_COUNT ? ["proteinas", "performance"] : ["proteinas"],
      images: Array.from({ length: imageTotal }, (_, imageIndex) => ({ storageKey: `products/${slug}/${imageIndex + 1}.webp`, position: imageIndex + 1 })),
      variants, tags: [], shippingRequired: true, weightGrams: 900, heightCm: 20, widthCm: 10, lengthCm: 10,
    };
  }) };
}

async function seedCategories(prisma: PrismaClient): Promise<void> {
  const categories = JSON.parse(await readFile(resolve(process.cwd(), "scrape-output/categories.json"), "utf8")) as Array<{ slug: string; name: string; parentSlug?: string; visibility: "visible" | "hidden"; sortOrder: number }>;
  const ids = new Map<string, string>();
  for (const category of categories) {
    const current = await prisma.category.findUnique({ where: { slug: category.slug } });
    if (current) { ids.set(category.slug, current.id); continue; }
    const created = await prisma.category.create({ data: { id: `bench-${category.slug}`, name: category.name, slug: category.slug, parentId: category.parentSlug ? ids.get(category.parentSlug) : null, sortOrder: category.sortOrder, visibility: category.visibility === "visible" ? "VISIBLE" : "HIDDEN" } });
    ids.set(category.slug, created.id);
  }
}

async function resetProducts(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProductCategory", "ProductVariant", "ProductImage", "Product" CASCADE');
}

async function counts(prisma: PrismaClient): Promise<{ products: number; variants: number; images: number; links: number }> {
  const [products, variants, images, links] = await Promise.all([prisma.product.count(), prisma.productVariant.count(), prisma.productImage.count(), prisma.productCategory.count()]);
  return { products, variants, images, links };
}

async function runRollback(repository: PrismaCatalogImportRepository, input: unknown, prisma: PrismaClient): Promise<{ ok: boolean; rowsAfterFailure: { products: number; variants: number; images: number; links: number } }> {
  const plan = normalizeCatalogImportManifest(input) as CatalogImportPlan;
  plan.products.at(-1)!.categorySlugs = ["missing-late-category"];
  let ok = true;
  try { await repository.persist(plan); } catch { ok = false; }
  return { ok: !ok, rowsAfterFailure: await counts(prisma) };
}

void main();
