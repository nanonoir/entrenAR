import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { getShopNavItems } from "../../src/lib/data/navigation";
import { resolveProductListing, slugifyProductListingValue } from "../../src/lib/product-listing";
import { CatalogApiRepository } from "../../src/lib/api/catalog/catalog-api.repository";
import type { CatalogApiClient } from "../../src/lib/api/catalog/client";
import type { CatalogListingFacet } from "../../src/lib/api/catalog/catalog.repository";
import type { ShakerBackup, ShakerSnapshot } from "../../backend/src/modules/catalog-scraper/operations/shaker-consolidation";

const BACKUP_HASH = "3c53c71cbf6be9e2882f898a4d72723f18b4c541e544a8eef872c2196df10cd8";
const RECEIPT_HASH = "43fb109d620cccd6f610207c8ea7883d88feaf4cf16cc826ef401d2bb4cc2308";
const AFTER_HASH = "8568d37871ad6d3baeb0c8785c559c12de3ed62808e734a48f28669b09437439";
const PRIVATE_ROOT = resolve(process.cwd(), "backend/backup");
const hash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

interface ReceiptCounts {
  products: number; variants: number; images: number; categories: number;
  links: number; rootMemberships: number; obsoleteCategories: number;
}
interface MergeReceipt {
  added: number; removed: number; deleted: number; noop: boolean; snapshotHash: string;
}
interface ExecutionEvidence {
  status: string;
  backupHash: string;
  receipt: MergeReceipt;
  postCommitSnapshotHash: string;
  expectedAfterHash: string;
  protectedInvariantHash: string;
  allProtectedTablesUnchanged: boolean;
  counts: ReceiptCounts;
}
interface BackupEnvelope { backup: ShakerBackup; sha256: string }
interface ReceiptEnvelope { evidence: ExecutionEvidence; sha256: string }

// This checks existing evidence only; it neither connects to a DB nor invokes the operation.
export async function checkRecordedConsolidation(): Promise<ShakerSnapshot> {
  const backup: BackupEnvelope = JSON.parse(await readFile(resolve(PRIVATE_ROOT,
    "shaker-current-b8eeee8f-1089-4fb8-b097-cac60c1d41d9.json"), "utf8"));
  const receipt: ReceiptEnvelope = JSON.parse(await readFile(resolve(PRIVATE_ROOT,
    "shaker-execution-31c15b99-c803-46dc-a47e-6eda6e1835ee.json"), "utf8"));
  assert.equal(backup.sha256, BACKUP_HASH);
  assert.equal(hash(backup.backup), BACKUP_HASH, "Original backup content drift");
  assert.equal(receipt.sha256, RECEIPT_HASH);
  assert.equal(hash(receipt.evidence), RECEIPT_HASH, "Execution evidence content drift");
  const { before, after, additions } = backup.backup;
  const evidence = receipt.evidence;
  assert.equal(hash(after), AFTER_HASH);
  assert.equal(evidence.status, "committed");
  assert.equal(evidence.backupHash, BACKUP_HASH);
  assert.equal(evidence.postCommitSnapshotHash, AFTER_HASH);
  assert.equal(evidence.expectedAfterHash, AFTER_HASH);
  assert.deepEqual(evidence.receipt, { added: 4, removed: 23, deleted: 1, noop: false, snapshotHash: AFTER_HASH });
  assert.deepEqual(before.invariants, after.invariants, "Protected tables changed in recorded snapshots");
  assert.equal(hash(after.invariants), evidence.protectedInvariantHash);
  assert.equal(evidence.allProtectedTablesUnchanged, true);
  assert.deepEqual(before.target, after.target);
  assert.deepEqual(before.connected, after.connected);
  assert.deepEqual(before.references, after.references);
  const obsolete = before.categories.find((row) => row["slug"] === "shakers-y-botellas");
  const root = before.categories.find((row) => row["slug"] === "shakers");
  assert.ok(obsolete && root, "Original category evidence missing");
  assert.deepEqual(after.categories, before.categories.filter((row) => row["id"] !== obsolete["id"]));
  const ordered = (rows: Record<string, unknown>[]) => [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.equal(additions.length, 4);
  assert.ok(additions.every((row) => row["categoryId"] === root["id"]));
  assert.deepEqual(after.links, ordered([...before.links.filter((row) => row["categoryId"] !== obsolete["id"]), ...additions]));
  assert.equal(new Set(after.links.map((row) => JSON.stringify([row["productId"], row["categoryId"]]))).size, after.links.length);
  const counts: Record<string, number> = after.counts;
  assert.deepEqual(after.counts, { ...before.counts, Category: 60, ProductCategory: 2105 });
  assert.deepEqual(evidence.counts, { products: counts["Product"], variants: counts["ProductVariant"],
    images: counts["ProductImage"], categories: after.categories.length, links: after.links.length,
    rootMemberships: after.links.filter((row) => row["categoryId"] === root["id"]).length,
    obsoleteCategories: after.categories.filter((row) => row["slug"] === "shakers-y-botellas").length });
  return after;
}

// A verifier can supply a fresh sanitized snapshot obtained in a READ ONLY transaction.
// Exact comparison deliberately includes auth-token hashes; this suite performs no login.
export function compareCurrentProtectedSnapshot(current: ShakerSnapshot, expected: ShakerSnapshot): void {
  assert.equal(hash(current), hash(expected), "Current DB drift: do not mutate or silently refresh evidence");
}

export interface ReferenceCategory { id: string; slug: string; name: string; parentId: string | null }
export interface ReferenceProduct {
  id: string; slug: string; brand: string; visibility: string; price: number;
  compareAtPrice: number | null; categoryIds: string[]; subcategorySlugs: string[];
}
export interface CatalogReference {
  source: string; snapshotHash: string; capturedAt: string;
  publicCategories: ReferenceCategory[]; products: ReferenceProduct[];
}
// Independent sanitized projection of ALL DB products/memberships and PUBLIC categories,
// captured in the same readonly transaction as the protected snapshot. Never export API results here.
export function loadCatalogReference(): CatalogReference {
  const path = process.env["CATALOG_ACCEPTANCE_REFERENCE"];
  const digest = process.env["CATALOG_ACCEPTANCE_REFERENCE_HASH"];
  assert.ok(path && digest, "Provide independent DB reference path and trusted JSON SHA-256");
  const value: CatalogReference = JSON.parse(readFileSync(resolve(path), "utf8"));
  assert.equal(hash(value), digest);
  assert.equal(value.source, "readonly-database");
  assert.equal(value.snapshotHash, AFTER_HASH, "Reference must bind to the approved post-merge snapshot");
  assert.ok(Number.isFinite(Date.parse(value.capturedAt)));
  assert.equal(new Set(value.products.map((p) => p.id)).size, value.products.length);
  assert.equal(new Set(value.publicCategories.map((c) => c.slug)).size, value.publicCategories.length);
  assert.ok(value.publicCategories.length > 0);
  for (const p of value.products) {
    assert.ok(Number.isFinite(p.price) && p.price >= 0 && Array.isArray(p.categoryIds) && Array.isArray(p.subcategorySlugs));
  }
  return value;
}
export function referenceScope(reference: CatalogReference, categorySlug?: string, brandSlug?: string): ReferenceProduct[] {
  const categories = reference.publicCategories;
  const root = categories.find((c) => c.slug === categorySlug);
  assert.ok(!categorySlug || root, "Unknown reference category");
  const descendantIds = new Set(root ? [root.id] : categories.map((c) => c.id));
  for (let pass = 0; root && pass < categories.length; pass++) {
    for (const c of categories) if (c.parentId && descendantIds.has(c.parentId)) descendantIds.add(c.id);
  }
  return reference.products.filter((p) => p.visibility === "VISIBLE"
    && p.categoryIds.some((id) => descendantIds.has(id))
    && (!brandSlug || slugifyProductListingValue(p.brand || "EntrenAR") === brandSlug));
}
export function referenceMetadata(products: ReferenceProduct[], categories: ReferenceCategory[], categorySlug?: string) {
  const count = (values: (p: ReferenceProduct) => string[]) => {
    const counts = new Map<string, number>();
    for (const p of products) for (const slug of new Set(values(p))) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
  };
  return { brands: count((p) => [slugifyProductListingValue(p.brand || "EntrenAR")]),
    categories: count((p) => categories.filter((c) => p.categoryIds.includes(c.id)).map((c) => c.slug)),
    subcategories: count((p) => {
      const associated = new Set(p.categoryIds);
      for (let pass = 0; pass < categories.length; pass++) {
        for (const category of categories) if (associated.has(category.id) && category.parentId) associated.add(category.parentId);
      }
      const children = categories.filter((c) => associated.has(c.id) && c.parentId);
      const parent = categories.find((c) => c.slug === categorySlug);
      return children.length
        ? children.filter((c) => !parent || c.parentId === parent.id).map((c) => c.slug)
        : p.subcategorySlugs.filter((slug) => !categories.some((c) => c.slug === slug));
    }),
    priceBounds: products.length ? { min: Math.min(...products.map((p) => p.price)), max: Math.max(...products.map((p) => p.price)) } : { min: 0, max: 0 } };
}
export function canonicalCategoryUrl(category: ReferenceCategory): string {
  const links = getShopNavItems().flatMap((item) => [item.href, ...(item.groups ?? []).flatMap((g) => [g.href, ...g.links.map((l) => l.href)])]).filter((href): href is string => Boolean(href));
  const aliases: Record<string, string> = { "creatina-y-pre": "pre-intra-creatina", vitaminas: "vitaminas-suplementos" };
  // Supplement navigation is supported hierarchically; other PUBLIC taxonomy slugs
  // resolve directly even when an older navigation URL has an unsupported nested shape.
  return links.find((href) => href.startsWith("/suplementos/") && href.split("/").at(-1) === (aliases[category.slug] ?? category.slug))
    ?? `/${encodeURIComponent(category.slug)}`;
}
export async function checkEmptyAndTransportFailure(): Promise<void> {
  const categories = [{ id: "empty-id", name: "Empty category", slug: "empty-category", parentId: null }];
  const empty = { items: [], page: 1, limit: 20, total: 0, totalPages: 0,
    facets: { brands: [], categories: [], subcategories: [] }, priceBounds: { min: 0, max: 0 } };
  const makeClient = (fail: boolean): CatalogApiClient => ({
    async get<T>(path: string): Promise<T> {
      if (path === "/categories") return categories as T;
      if (fail) throw new Error("Injected SSR transport failure");
      return empty as T;
    },
  });
  const valid = await resolveProductListing(["empty-category"], {}, new CatalogApiRepository(makeClient(false)));
  const failed = await resolveProductListing(["empty-category"], {}, new CatalogApiRepository(makeClient(true)));
  assert.equal(valid?.status, "empty");
  assert.equal(failed?.status, "error");
  assert.equal(failed?.error?.code, "CATALOG_ADAPTER_ERROR");
  const pendingRepository = new CatalogApiRepository(makeClient(false));
  pendingRepository.getPublicListing = async () => ({ status: "loading" });
  const pending = await resolveProductListing(["empty-category"], {}, pendingRepository);
  assert.equal(pending?.status, "error");
  assert.equal(pending?.error?.code, "CATALOG_LOADING");
  const families = [
    ["pre-intra-creatina", "creatina-y-pre", "creatina"], ["pre-intra-creatina", "creatina-y-pre", "pre-intra-entreno"],
    ["vitaminas-suplementos", "vitaminas", "adaptogenos-hierbas"], ["vitaminas-suplementos", "vitaminas", "antioxidantes"],
    ["control-de-peso", "control-de-peso", "cafeina"], ["control-de-peso", "control-de-peso", "cla"],
  ];
  for (const [alias, parent, leaf] of families) {
    let lastQuery = new URLSearchParams();
    const taxonomy = [{ id: parent, name: parent, slug: parent }, { id: leaf, name: leaf, slug: leaf, parentId: parent }];
    const client: CatalogApiClient = { async get<T>(path: string): Promise<T> {
      if (path === "/categories") return taxonomy as T;
      lastQuery = new URL(path, "http://fixture").searchParams;
      return { ...empty, facets: { ...empty.facets, subcategories: [{ count: 2, label: leaf, slug: leaf }] } } as T;
    } };
    const repository = new CatalogApiRepository(client);
    const nested = await resolveProductListing(["suplementos", alias!, leaf!], {}, repository);
    assert.equal(nested?.context.categorySlug, leaf);
    assert.equal(lastQuery.get("categorySlug"), leaf);
    assert.equal(lastQuery.get("subcategorySlugs"), leaf);
    const checkbox = await resolveProductListing(["suplementos", alias!], { subcategoria: leaf }, repository);
    assert.equal(lastQuery.get("categorySlug"), parent);
    assert.equal(lastQuery.get("subcategorySlugs"), leaf);
    assert.equal(checkbox?.filterGroups.find((group) => group.id === "subcategory")?.options[0]?.count, 2);
    await resolveProductListing(["suplementos", alias!, leaf!], { subcategoria: "other" }, repository);
    assert.equal(lastQuery.get("subcategorySlugs"), "__no_matching_subcategory__");
    taxonomy[1]!.parentId = "wrong-parent";
    assert.equal(await resolveProductListing(["suplementos", alias!, leaf!], {}, repository), null);
    taxonomy.pop();
    const legacy = await resolveProductListing(["suplementos", alias!, leaf!], {}, repository);
    assert.equal(legacy?.context.categorySlug, parent);
  }
}

export const publishedCategoryPaths = [
  ...["alfajor", "barras", "endulzantes", "enlatado", "frutos-secos", "hierba-mate", "jerky", "pastas-de-mani", "polvos-mezclas", "salsas"].map((slug) => `/market/${slug}`),
  ...["entreno", "shark", "symmetry", "xbelt"].map((slug) => `/indumentaria/${slug}`),
];
export const publishedBrandAliases = [
  ["balboa-fit", "balboafit", 4], ["framingham", "framingham-pharma", 8],
  ["notco", "not-co", 2], ["natures-bounty", "nature-s-bounty", 20],
] as const;

export async function checkPublishedNavigation(): Promise<void> {
  const roots = ["market", "indumentaria"].map((slug) => ({ id: slug, name: slug, slug }));
  const taxonomy = [...roots, ...publishedCategoryPaths.map((path) => {
    const [, parentId, slug] = path.split("/"); return { id: slug, name: slug, slug, parentId };
  })];
  const brands: CatalogListingFacet[] = publishedBrandAliases.map(([, slug, count]) => ({ slug, label: slug, count }));
  let query = new URLSearchParams();
  const client: CatalogApiClient = { async get<T>(path: string): Promise<T> {
    if (path === "/categories") return taxonomy as T;
    if (path === "/brands") return brands as T;
    query = new URL(path, "http://fixture").searchParams;
    const page = Number(query.get("page") ?? 1);
    const limit = Number(query.get("limit") ?? 20);
    assert.ok(Number.isInteger(page) && page > 0 && Number.isInteger(limit) && limit > 0);
    const records: never[] = []; // Deliberate known-resource, zero-result transport fixture.
    return { items: records.slice((page - 1) * limit, page * limit), total: records.length,
      totalPages: Math.ceil(records.length / limit), page, limit,
      facets: { brands: [], categories: [], subcategories: [] }, priceBounds: { min: 0, max: 0 } } as T;
  } };
  const sample = await client.get<{ page: number; limit: number; total: number; totalPages: number; items: unknown[] }>("/products?page=3&limit=7");
  assert.deepEqual(sample, { page: 3, limit: 7, total: 0, totalPages: 0, items: [],
    facets: { brands: [], categories: [], subcategories: [] }, priceBounds: { min: 0, max: 0 } });
  const repository = new CatalogApiRepository(client);
  const params = { page: "2", orden: "menor-precio", campaign: "navigation" };
  for (const path of publishedCategoryPaths) {
    const [parent, leaf] = path.slice(1).split("/");
    const result = await resolveProductListing([parent!, leaf!], params, repository);
    assert.equal(result?.status, "empty"); assert.equal(query.get("categorySlug"), leaf);
    assert.equal(result?.page, 2); assert.equal(result?.totalCount, 0); assert.equal(result?.totalPages, 0); assert.deepEqual(result?.products, []);
    assert.equal(query.has("subcategorySlugs"), false); assert.equal(result?.context.routePath, path);
    assert.equal(result?.context.canonicalPath, undefined); assert.equal(query.get("page"), "2");
    assert.equal(await resolveProductListing([parent === "market" ? "indumentaria" : "market", leaf!], {}, repository), null);
    const direct = await resolveProductListing([leaf!], {}, repository);
    assert.equal(direct?.status, "empty"); assert.equal(direct?.context.canonicalPath, undefined);
  }
  for (const [alias, target] of publishedBrandAliases) {
    const result = await resolveProductListing(["marcas", alias], params, repository);
    assert.equal(result?.context.canonicalPath, `/marcas/${target}`); assert.equal(query.get("brandSlug"), target);
    assert.equal((await resolveProductListing(["marcas", target], {}, repository))?.context.canonicalPath, undefined);
  }
  brands.push({ slug: "star-nutrition", label: "Star Nutrition", count: 51 }, { slug: "percent-power", label: "100% Power", count: 1 });
  for (const segment of ["Star%20Nutrition", "Star Nutrition", "STAR NUTRITION", "Stár Nutrition", "St%C3%A1r%20Nutrition", "%73tar-nutrition"]) {
    const result = await resolveProductListing(["marcas", segment], params, repository);
    assert.equal(result?.context.canonicalPath, "/marcas/star-nutrition"); assert.equal(query.get("brandSlug"), "star-nutrition");
    assert.equal(query.get("page"), "2"); assert.equal(query.get("sort"), "price-asc");
    assert.deepEqual(params, { page: "2", orden: "menor-precio", campaign: "navigation" });
  }
  assert.equal((await resolveProductListing(["marcas", "star-nutrition"], params, repository))?.context.canonicalPath, undefined);
  assert.equal((await resolveProductListing(["marcas", "100% Power"], {}, repository))?.context.canonicalPath, "/marcas/percent-power");
  assert.equal((await resolveProductListing(["marcas", "BALBOA-FIT"], {}, repository))?.context.canonicalPath, "/marcas/balboafit");
  for (const segment of ["Star%2520Nutrition", "unknown%20brand", "Star%ZZNutrition", "Star%20Nutrition%", "Star%2fNutrition", "Star%5cNutrition", "Star%00Nutrition"]) {
    assert.equal(await resolveProductListing(["marcas", segment], {}, repository), null);
  }
  assert.equal(await resolveProductListing(["marcas", "unknown-acceptance-brand"], {}, repository), null);
  assert.equal(await resolveProductListing(["market", "unknown-leaf"], {}, repository), null);
  repository.getPublicBrands = async () => ({ status: "empty", data: [] });
  assert.equal(await resolveProductListing(["marcas", "balboa-fit"], {}, repository), null);
  for (const status of ["error", "loading"] as const) {
    const pending = status === "error" ? { status, error: { code: "API_UNAVAILABLE", message: "Unavailable" } } : { status };
    repository.getPublicCategories = async () => pending; repository.getPublicBrands = async () => pending;
    for (const segments of [["market", "alfajor"], ["marcas", "balboa-fit"]]) {
      const result = await resolveProductListing(segments, {}, repository);
      assert.equal(result?.status, "error"); assert.equal(result?.error?.code, status === "error" ? "API_UNAVAILABLE" : "CATALOG_LOADING");
    }
  }
  repository.getPublicCategories = async () => ({ status: "success", data: roots.map(({ slug }) => ({ slug, label: slug, description: "Fixture" })) });
  const legacy = await resolveProductListing(["market", "alfajor"], {}, repository);
  assert.equal(legacy?.context.categorySlug, "market"); assert.equal(query.get("subcategorySlugs"), "alfajor");
}

async function main(): Promise<void> {
  const expected = await checkRecordedConsolidation();
  await checkEmptyAndTransportFailure();
  await checkPublishedNavigation();
  const currentPath = process.env["CATALOG_ACCEPTANCE_SNAPSHOT"];
  if (currentPath) {
    const current: ShakerSnapshot = JSON.parse(await readFile(resolve(currentPath), "utf8"));
    compareCurrentProtectedSnapshot(current, expected);
  }
  console.log(JSON.stringify({ recordedEvidence: "pass", currentSnapshot: currentPath ? "pass" : "not checked",
    backupHash: BACKUP_HASH, receiptHash: RECEIPT_HASH, snapshotHash: AFTER_HASH }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("tests/harnesses/catalog-listing-acceptance.harness.ts")) {
  void main().catch(() => { console.error("Catalog invariant evidence check failed; no rows or credentials emitted."); process.exitCode = 1; });
}
