import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { CatalogImportManifest } from "../../catalog-import/manifest-validator";
import { digest } from "../run/run-store";

export interface LocalAssetSource { url: string; position: number; response: { status: number; headers: Headers; arrayBuffer(): Promise<ArrayBuffer> } }
export interface LocalAssetInventoryItem { key: string; sha256: string; size: number; sourceUrl: string; position: number }
export interface ProductGalleryImage { id: string; url: string }
export type LocalAssetFetcher = (url: string) => Promise<LocalAssetSource["response"]>;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export function canonicalAssetKey(productSlug: string, position: number): string { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug) || !Number.isInteger(position) || position < 1) throw new Error("Unsafe asset identity."); return `products/${productSlug}/${position}.webp`; }
export function localAssetPath(assetsRoot: string, key: string): string {
  if (!/^products\/[a-z0-9]+(?:-[a-z0-9]+)*\/\d+\.webp$/.test(key)) throw new Error("Noncanonical local asset key.");
  return resolve(assetsRoot, key);
}
export function validateWebpBytes(bytes: Uint8Array, contentType: string): void {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_ASSET_BYTES || !/^image\/(?:webp|x-webp)$/i.test(contentType) || Buffer.from(bytes.subarray(0, 4)).toString() !== "RIFF" || Buffer.from(bytes.subarray(8, 12)).toString() !== "WEBP" || Buffer.from(bytes.subarray(4, 8)).readUInt32LE(0) + 8 !== bytes.byteLength) throw new Error("INVALID_IMAGE_ASSET");
}
export async function downloadLocalAsset(root: string, productSlug: string, source: LocalAssetSource): Promise<LocalAssetInventoryItem> {
  if (source.response.status !== 200) throw new Error("INVALID_IMAGE_ASSET"); const bytes = new Uint8Array(await source.response.arrayBuffer()); validateWebpBytes(bytes, source.response.headers.get("content-type") ?? "");
  const key = canonicalAssetKey(productSlug, source.position); const path = resolve(root, key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: "wx" });
  return { key, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.byteLength, sourceUrl: sanitizeSourceUrl(source.url), position: source.position };
}

export async function stageProductGallery(runDirectory: string, productSlug: string, gallery: readonly ProductGalleryImage[], fetcher: LocalAssetFetcher, concurrency = 3): Promise<LocalAssetInventoryItem[]> {
  if (gallery.length === 0) throw new Error("INVALID_IMAGE_ASSET");
  const stagingRoot = resolve(runDirectory, ".asset-staging", `${productSlug}-${randomUUID()}`);
  const assetsRoot = resolve(runDirectory, "assets");
  const completed: LocalAssetInventoryItem[] = [];
  const promotedPaths: string[] = [];
  const stagingParent = resolve(runDirectory, ".asset-staging");
  await mkdir(stagingParent, { recursive: true });
  await assertDirectory(stagingParent);
  await mkdir(stagingRoot);
  try {
    const staged = await mapSettled(gallery, async (image, index) => downloadLocalAsset(stagingRoot, productSlug, {
      url: image.url,
      position: index + 1,
      response: await fetcher(image.url),
    }), Math.min(Math.max(1, concurrency), 3));
    const failure = staged.find((entry) => !entry.ok);
    if (failure && !failure.ok) throw failure.error;
    completed.push(...staged.map((entry) => {
      if (!entry.ok) throw entry.error;
      return entry.value;
    }));
    const productsRoot = resolve(assetsRoot, "products");
    await mkdir(assetsRoot, { recursive: true });
    await assertDirectory(assetsRoot);
    await mkdir(productsRoot, { recursive: true });
    await assertDirectory(productsRoot);
    for (const item of completed) {
      const stagedPath = resolve(stagingRoot, item.key);
      const finalPath = resolve(assetsRoot, item.key);
      await mkdir(dirname(finalPath), { recursive: true });
      await assertDirectory(dirname(finalPath));
      await link(stagedPath, finalPath);
      promotedPaths.push(finalPath);
    }
    return completed;
  } catch (error) {
    await Promise.all(promotedPaths.map((path) => unlink(path).catch(() => undefined)));
    await removeProductAssets(runDirectory, productSlug);
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(stagingParent, { recursive: false, force: true }).catch(() => undefined);
  }
}

async function removeProductAssets(runDirectory: string, productSlug: string): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) return;
  const assetsRoot = resolve(runDirectory, "assets");
  try { await assertDirectory(assetsRoot); await assertDirectory(resolve(assetsRoot, "products")); }
  catch { return; }
  const productDirectory = resolve(assetsRoot, "products", productSlug);
  const relativePath = relative(assetsRoot, productDirectory);
  if (relativePath.startsWith("..") || resolve(assetsRoot, relativePath) !== productDirectory) throw new Error("Unsafe product asset cleanup path.");
  await rm(productDirectory, { recursive: true, force: true }).catch(() => undefined);
}

async function assertDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Unsafe local asset directory.");
}

export async function assertExactLocalAssetSet(runDirectory: string, manifest: CatalogImportManifest, inventory: readonly LocalAssetInventoryItem[]): Promise<void> {
  const expected = manifest.products.flatMap((product) => product.images.map((image) => image.storageKey)).sort();
  const actual = inventory.map((item) => item.key).sort();
  if (new Set(actual).size !== actual.length || expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw new Error("Manifest and local asset inventory differ.");
  }
  for (const item of inventory) {
    if (item.key !== canonicalAssetKey(item.key.split("/")[1] ?? "", item.position)) throw new Error("Noncanonical local asset inventory key.");
    const bytes = await readFile(resolve(runDirectory, "assets", item.key));
    if (bytes.byteLength !== item.size || digest(bytes) !== item.sha256) throw new Error(`Local asset integrity mismatch: ${item.key}`);
  }
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function mapSettled<T, R>(items: readonly T[], worker: (item: T, index: number) => Promise<R>, concurrency: number): Promise<Array<Settled<R>>> {
  const results: Array<Settled<R>> = new Array(items.length);
  let cursor = 0;
  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { ok: true, value: await worker(items[index]!, index) }; }
      catch (error) { results[index] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
  return results;
}
function sanitizeSourceUrl(value: string): string { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return "[invalid-url]"; } }
