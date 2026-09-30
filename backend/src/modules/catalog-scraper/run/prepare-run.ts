import { discoverProductUrls, extractProducts, fetchWithRetry, type ExtractedProduct, type HttpPort } from "../scraper";
import { loadApprovedTaxonomy } from "../taxonomy";
import { transformProducts, canonicalSlug } from "../transformer";
import { assertExactLocalAssetSet, stageProductGallery, type LocalAssetFetcher, type LocalAssetInventoryItem } from "../storage/local-assets";
import { createPipelineReport, renderReport } from "../report";
import { RUN_STATUS, RunStore } from "./run-store";
import { collectCategoryMemberships } from "../category-memberships";
import { SystemicSourceSchemaError } from "../source-data/tiendanube-product";
import type { SourceCategoryMapping } from "../taxonomy";

export interface PrepareRunPorts {
  store: RunStore;
  fetcher?: HttpPort;
  extract?: (urls: readonly string[]) => Promise<{ products: ExtractedProduct[]; failures: Array<{ url: string; code: string; message: string }> }>;
  loadTaxonomy?: typeof loadApprovedTaxonomy;
  resolveCategoryMemberships?: typeof collectCategoryMemberships;
  fetchAsset?: LocalAssetFetcher;
}

export interface PrepareRunResult { runId: string; status: "PREPARED" | "NOT_READY" | "FAILED"; report: ReturnType<typeof createPipelineReport> }

export async function prepareRun(sitemapUrl: string, ports: PrepareRunPorts): Promise<PrepareRunResult> {
  const run = await ports.store.allocate();
  const startedAt = new Date().toISOString();
  const report = createPipelineReport();
  report.runId = run.runId;
  report.observationWindow = { startedAt };
  let discoveredUrls: string[] = [];
  let activeStage = "sitemap";
  try {
    await ports.store.transition(run.runId, RUN_STATUS.EXTRACTING, { extractionWindow: { startedAt } });
    const sitemap = await fetchWithRetry(sitemapUrl, { fetcher: ports.fetcher });
    if (sitemap.status !== 200) throw new Error("Sitemap request failed.");
    activeStage = "discovery";
    const discovered = discoverProductUrls(await sitemap.text());
    discoveredUrls = discovered.urls;
    if (!discovered.urls.length) throw new Error("Sitemap contained no product URLs.");
    report.counts.discovered = discovered.urls.length;
    report.counts.duplicateUrls = discovered.duplicates;
    report.stages.discovery = "ok";

    activeStage = "taxonomy";
    const taxonomy = await (ports.loadTaxonomy ?? loadApprovedTaxonomy)();
    report.stages.taxonomy = "ok";
    activeStage = "categoryMemberships";
    const memberships = await (ports.resolveCategoryMemberships ?? collectCategoryMemberships)(taxonomy.mappings, ports.fetcher);
    report.stages.categoryMemberships = "ok";
    report.counts.productsWithCategoryMemberships = memberships.size;
    report.counts.categoryMembershipLinks = [...memberships.values()].reduce((total, categories) => total + categories.length, 0);
    activeStage = "extraction";
    const extraction = await (ports.extract ?? ((urls) => extractProducts(urls, { fetcher: ports.fetcher })))(discovered.urls);
    report.stages.extraction = "ok";
    const extracted = {
      failures: extraction.failures,
      products: extraction.products.map((product) => {
        if (!product.sourceProduct) return product;
        const sourceCategories = memberships.get(product.sourceProduct.sourceId) ?? [];
        return {
          ...product,
          categories: sourceCategories,
          sourceProduct: {
            ...product.sourceProduct,
            categories: sourceCategories.map((sourceCategory) => ({ sourceCategory, path: sourceCategoryPath(sourceCategory, taxonomy.mappings) })),
          },
        };
      }),
    };
    activeStage = "transformation";
    const transformed = transformProducts(extracted.products, taxonomy);
    report.exclusions.push(...transformed.exclusions);
    report.warnings.push(...transformed.warnings);
    report.stages.transformation = transformed.manifest ? "ok" : "failed";

    const excludedBySlug = new Map<string, string>();
    for (const item of transformed.exclusions) for (const slug of item.product.split(",")) excludedBySlug.set(slug, item.code);
    const extractionByUrl = new Map(extracted.failures.map((failure) => [failure.url, failure]));
    const extractedByUrl = new Map(extracted.products.map((product) => [product.url, product]));
    const acceptedManifest = transformed.manifest ? { products: [...transformed.manifest.products] } : { products: [] };
    const inventory: LocalAssetInventoryItem[] = [];
    const acceptedSlugs = new Set<string>();
    const assetFetcher: LocalAssetFetcher = ports.fetchAsset ?? (async (url) => {
      const response = await fetchWithRetry(url, { fetcher: ports.fetcher });
      return { status: response.status, headers: response.headers, arrayBuffer: () => response.arrayBuffer() };
    });
    activeStage = "localAssets";
    const assetFailures = new Map<string, string>();
    for (const product of acceptedManifest.products) {
      const source = [...extractedByUrl.values()].find((candidate) => sourceSlug(candidate.url) === product.slug);
      if (!source?.sourceProduct) {
        assetFailures.set(product.slug, "MISSING_STRUCTURED_SOURCE");
        continue;
      }
      try {
        inventory.push(...await stageProductGallery(ports.store.path(run.runId, ""), product.slug, source.sourceProduct.gallery, assetFetcher, 3));
        acceptedSlugs.add(product.slug);
      } catch {
        assetFailures.set(product.slug, "INVALID_IMAGE_ASSET");
      }
    }
    acceptedManifest.products = acceptedManifest.products.filter((product) => acceptedSlugs.has(product.slug));
    report.exclusions.push(...[...assetFailures].map(([product, code]) => ({ code, product, message: code === "INVALID_IMAGE_ASSET" ? "A selected gallery image failed local validation." : "No decoded source gallery was available." })));
    if (acceptedManifest.products.length) {
      const { normalizeCatalogImportManifest } = await import("../../catalog-import/manifest-validator");
      normalizeCatalogImportManifest(acceptedManifest);
      await assertExactLocalAssetSet(ports.store.path(run.runId, ""), acceptedManifest, inventory);
      report.stages.localAssets = "ok";
      report.stages.exactSet = "ok";
      report.stages.manifest = "ok";
    } else {
      report.stages.localAssets = "failed";
      report.stages.exactSet = "failed";
      report.stages.manifest = "failed";
      report.blockers.push("NO_ACCEPTED_PRODUCTS");
    }

    for (const url of discovered.urls) {
      const failure = extractionByUrl.get(url);
      const product = extractedByUrl.get(url);
      if (failure) {
        report.outcomes.push({ url, result: "EXTRACTION_FAILED", reason: failure.code });
        report.exclusions.push({ code: failure.code, product: url, message: failure.message });
        continue;
      }
      const slug = product ? sourceSlug(product.url) : "";
      const transformedReason = excludedBySlug.get(slug);
      if (transformedReason) report.outcomes.push({ url, result: "EXCLUDED", reason: transformedReason });
      else if (assetFailures.has(slug)) report.outcomes.push({ url, result: "EXCLUDED", reason: assetFailures.get(slug)! });
      else if (acceptedSlugs.has(slug)) report.outcomes.push({ url, result: "ACCEPTED", reason: "ACCEPTED" });
      else report.outcomes.push({ url, result: "EXCLUDED", reason: "TRANSFORMATION_FAILED" });
    }
    report.counts.accepted = acceptedManifest.products.length;
    report.counts.excluded = report.outcomes.filter((entry) => entry.result === "EXCLUDED").length;
    report.counts.extractionFailed = report.outcomes.filter((entry) => entry.result === "EXTRACTION_FAILED").length;
    report.counts.assets = inventory.length;
    report.expectedObjects = inventory.length;
    report.readiness = "NOT_READY";
    report.blockers.push("HANDOFF_REQUIRED");
    report.observationWindow = { startedAt, endedAt: new Date().toISOString() };
    activeStage = "manifest";
    if (acceptedManifest.products.length === 0) throw new Error("No products passed preparation validation.");
    const frozenInventory = inventory.map(({ key, sha256, size }) => ({ key, sha256, size })).sort((left, right) => left.key.localeCompare(right.key));
    const files = {
      "source.json": JSON.stringify({ discoveredUrls: discovered.urls, products: extracted.products.map((product) => product.sourceProduct).filter(Boolean), failures: extracted.failures }, null, 2) + "\n",
      "taxonomy.json": JSON.stringify({ categories: taxonomy.categories, mappings: taxonomy.mappings }, null, 2) + "\n",
      "categories.json": JSON.stringify(taxonomy.categories, null, 2) + "\n",
      "products.json": JSON.stringify(acceptedManifest, null, 2) + "\n",
      "inventory.json": JSON.stringify(frozenInventory, null, 2) + "\n",
      "report.md": renderReport(report),
    };
    activeStage = "snapshotFreeze";
    const frozen = await ports.store.freezePreparation(run.runId, files, frozenInventory, report.counts, report.observationWindow.endedAt);
    report.manifestSha256 = frozen.manifestSha256;
    return { runId: run.runId, status: frozen.status === RUN_STATUS.FAILED ? "FAILED" : "PREPARED", report };
  } catch (error) {
    report.readiness = "NOT_READY";
    const endedAt = new Date().toISOString();
    report.observationWindow = { startedAt, endedAt };
    const failure = error instanceof Error ? error.message : "PREPARATION_FAILED";
    report.blockers.push(failure);
    report.stages[activeStage] = "failed";
    if (error instanceof SystemicSourceSchemaError) {
      const attempted = [...new Set(error.attemptedUrls)];
      report.counts.extractionFailed = attempted.length;
      report.counts.notAttempted = Math.max(0, discoveredUrls.length - attempted.length);
      for (const url of attempted) {
        report.outcomes.push({ url, result: "EXTRACTION_FAILED", reason: "SYSTEMIC_SOURCE_SCHEMA_FAILURE" });
        report.exclusions.push({ code: "SYSTEMIC_SOURCE_SCHEMA_FAILURE", product: url, message: error.detail });
      }
    }
    try {
      const current = await ports.store.load(run.runId);
      const failureRecord = {
        ...current,
        status: RUN_STATUS.FAILED,
        blockers: report.blockers,
        counts: { ...current.counts, ...report.counts, discovered: discoveredUrls.length },
        stages: { ...current.stages, ...report.stages },
        extractionWindow: { startedAt, endedAt },
        results: { ...current.results, failureStage: activeStage, failure: { code: error instanceof SystemicSourceSchemaError ? "SOURCE_SCHEMA_INVALID" : "PREPARATION_FAILED", ...(error instanceof SystemicSourceSchemaError ? { sourceUrls: error.attemptedUrls.map(sanitizePublicUrl) } : {}) } },
      };
      await ports.store.save(failureRecord);
      await ports.store.writeImmutable(run.runId, "report.md", renderReport(report));
    } catch { /* Preserve the original failure result if diagnostics cannot be persisted. */ }
    return { runId: run.runId, status: "FAILED", report };
  }
}

function sourceCategoryPath(sourceCategory: string, mappings: readonly SourceCategoryMapping[]): string[] {
  const bySlug = new Map(mappings.map((mapping) => [mapping.normalizedSlug, mapping]));
  const byName = new Map(mappings.map((mapping) => [mapping.sourceCategory, mapping]));
  const path: string[] = [];
  let current = byName.get(sourceCategory);
  while (current) {
    path.unshift(current.sourceCategory);
    current = current.parentSlug ? bySlug.get(current.parentSlug) : undefined;
  }
  if (path.length === 0) throw new Error(`Unknown source category membership: ${sourceCategory}`);
  return path;
}

function sanitizePublicUrl(value: string): string {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return "[invalid-url]"; }
}

function sourceSlug(url: string): string {
  try { const segment = new URL(url).pathname.split("/").filter(Boolean).at(-1); return segment ? canonicalSlug(decodeURIComponent(segment)) : ""; }
  catch { return ""; }
}
