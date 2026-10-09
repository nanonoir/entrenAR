import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeCatalogImportManifest } from "../catalog-import/manifest-validator";
import { validateCategoryArtifact } from "./taxonomy";
import { createPipelineReport, writePipelineOutputs } from "./report";

async function main(): Promise<void> {
  const outputDirectory = resolve(process.argv[2] ?? "scrape-output");
  const reconciliationPath = resolve(process.argv[3] ?? "openspec/reports/prd2-category-reconciliation.json");
  const source = JSON.parse(await readFile(reconciliationPath, "utf8")) as { proposedCategorySnapshot?: unknown };
  const categories = validateCategoryArtifact((source.proposedCategorySnapshot as Array<{ normalizedSlug: string | null; name: string; parentSlug?: string | null; action: string }>).filter((category) => category.action !== "reject").map((category, index) => ({
    slug: category.normalizedSlug,
    name: category.name,
    ...(category.parentSlug ? { parentSlug: category.parentSlug } : {}),
    visibility: "visible" as const,
    sortOrder: index + 1,
  })));
  if (categories.length !== 61) throw new Error(`Expected 61 approved categories, received ${categories.length}.`);
  const manifest = normalizeCatalogImportManifest({ products: [{ slug: "prd2-fixture-whey", publicSlug: "prd2-fixture-whey", name: "PRD2 Fixture Whey", brand: "EntrenAR Fixture", descriptionHtml: "<p>Deterministic PRD2 handoff fixture.</p>", price: 100, categorySlugs: ["proteinas", "performance"], images: [{ storageKey: "products/prd2-fixture-whey/1.webp", position: 1, alt: "PRD2 Fixture Whey" }], variants: [{ sku: "PRD2-FIXTURE-WHEY-001", attributes: {}, stockMode: "TRACKED", quantity: 0, primaryImageStorageKey: "products/prd2-fixture-whey/1.webp" }], variantProperties: [], tags: ["fixture"], shippingRequired: true, weightGrams: 900, heightCm: 20, widthCm: 10, lengthCm: 10 }] });
  const canonicalProducts = manifest.products.map((product) => { const canonical = { ...product } as unknown as Record<string, unknown>; for (const field of ["missingLogistics", "publicSlug", "descriptionHtml"]) delete canonical[field]; return canonical; });
  const report = createPipelineReport(); report.readiness = "READY"; report.stages.taxonomy = "ok"; report.stages.validation = "ok"; report.stages.assets = "ok"; report.counts.categories = categories.length; report.counts.products = manifest.products.length; report.counts.variants = manifest.products.reduce((total, product) => total + product.variants.length, 0); report.counts.images = manifest.products.reduce((total, product) => total + product.images.length, 0); report.warnings.push("Fixture handoff: network and storage adapters are mocked; catalog:import was not invoked.");
  await writePipelineOutputs(outputDirectory, categories, { products: canonicalProducts }, report);
}

void main();
