import { lstat, readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { z } from "zod";
import { digest, RUN_STATUS, RunStore, type RunRecord, type RunStatus } from "../run/run-store";
import { normalizeCatalogImportManifest } from "../../catalog-import/manifest-validator";
import { localAssetPath, validateWebpBytes } from "../storage/local-assets";

const argsSchema = z.record(z.string(), z.string()).superRefine((args, ctx) => {
  const required = ["run-id", "environment", "destination-fingerprint", "manifest-sha256", "expected-count", "run-root"];
  for (const key of required) if (!args[key]) ctx.addIssue({ code: "custom", message: `Missing --${key}.` });
  if (args.prefix !== undefined && args.prefix !== "products/") ctx.addIssue({ code: "custom", message: "Prefix must be products/." });
});

export interface OperationalRunBinding { runId: string; environment: string; destinationFingerprint: string; manifestSha256: string; expectedCount: number; runRoot: string; runDirectory: string; categoriesPath: string; manifestPath: string; inventoryPath: string; assetsRoot: string; run: RunRecord }

export async function parseOperationalArgs(argv: readonly string[], extras: { requirePrefix?: boolean; verifyFrozenDigests?: boolean; verifyManifestApproval?: boolean } = {}): Promise<OperationalRunBinding> {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) throw new Error("Only named flags are accepted.");
    const key = token.slice(2);
    if (values[key] !== undefined) throw new Error(`Duplicate --${key}.`);
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    values[key] = value;
  }
  if (extras.requirePrefix && values.prefix === undefined) throw new Error("Missing --prefix.");
  const parsed = argsSchema.parse(values);
  const runId = parsed["run-id"]!;
  const environment = parsed.environment!;
  const destinationFingerprint = parsed["destination-fingerprint"]!;
  const manifestSha256 = parsed["manifest-sha256"]!;
  const expectedCount = Number(parsed["expected-count"]!);
  if (!Number.isInteger(expectedCount) || expectedCount < 0) throw new Error("Expected count must be a non-negative integer.");
  const runRoot = await realpath(resolve(parsed["run-root"]!));
  const runDirectory = resolve(runRoot, runId);
  if (relative(runRoot, runDirectory).startsWith("..") || !/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Unsafe run path.");
  const store = new RunStore(runRoot);
  const run = await store.load(runId);
  const consumableStatuses: RunStatus[] = [RUN_STATUS.ASSETS_VALIDATED, RUN_STATUS.R2_RESET, RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED, RUN_STATUS.READY, RUN_STATUS.IMPORTING, RUN_STATUS.IMPORTED];
  if (!consumableStatuses.includes(run.status) || run.results["preparationStatus"] !== "NOT_READY") throw new Error("Preparation evidence is incomplete or not eligible for operational handoff.");
  for (const stage of ["snapshotFreeze", "taxonomy", "localAssets", "exactSet", "manifest"]) if (run.stages[stage] !== "ok") throw new Error(`Preparation stage is missing: ${stage}.`);
  if (!run.fileDigests) throw new Error("Frozen preparation digests are missing.");
  // `targetFingerprint` is reserved for the database destination. The R2
  // destination is confirmed independently and must never claim that field.
  if (run.r2DestinationFingerprint && run.r2DestinationFingerprint !== destinationFingerprint) throw new Error("R2 destination fingerprint does not match selected run.");
  if (extras.verifyManifestApproval !== false && run.manifestSha256 && run.manifestSha256 !== manifestSha256) throw new Error("Manifest digest does not match selected run.");
  const files = { categoriesPath: resolve(runDirectory, "categories.json"), manifestPath: resolve(runDirectory, "products.json"), inventoryPath: resolve(runDirectory, "inventory.json"), assetsRoot: resolve(runDirectory, "assets") };
  if (await realpath(runDirectory) !== runDirectory) throw new Error("Run directory is not a canonical path.");
  for (const [name, file] of Object.entries(files)) { if (relative(runDirectory, file).startsWith("..")) throw new Error(`Unsafe ${name}.`); if (name !== "assetsRoot" && (await lstat(file)).isSymbolicLink()) throw new Error(`Symlink ${name} is not allowed.`); }
  for (const fileName of ["source.json", "taxonomy.json", "categories.json", "products.json", "inventory.json", "report.md"]) {
    const filePath = store.path(runId, fileName);
    if ((await lstat(filePath)).isSymbolicLink()) throw new Error(`Symlink ${fileName} is not allowed.`);
    if (extras.verifyFrozenDigests !== false && digest(await readFile(filePath)) !== run.fileDigests[fileName]) throw new Error(`Frozen ${fileName} digest changed.`);
  }
  const manifestBytes = await readFile(files.manifestPath); if (extras.verifyFrozenDigests !== false && digest(manifestBytes) !== manifestSha256) throw new Error("Frozen manifest digest changed.");
  const manifest = normalizeCatalogImportManifest(JSON.parse(manifestBytes.toString("utf8")) as unknown);
  const inventory = JSON.parse(await readFile(files.inventoryPath, "utf8")) as Array<{ key: string; size: number; sha256: string }>;
  if (inventory.length !== expectedCount) throw new Error("Frozen inventory count does not match confirmation.");
  if (inventory.some((item) => typeof item !== "object" || item === null || !/^products\/[a-z0-9-]+\/\d+\.webp$/.test(String((item as { key?: unknown }).key)))) throw new Error("Frozen inventory contains a noncanonical key.");
  const manifestKeys = manifest.products.flatMap((product) => product.images.map((image) => image.storageKey)).sort();
  const inventoryKeys = inventory.map((item) => item.key).sort();
  const recordedObjects = run.expectedObjects.map(({ key, sha256, size }) => ({ key, sha256, size })).sort((left, right) => left.key.localeCompare(right.key));
  const frozenObjects = inventory.map(({ key, sha256, size }) => ({ key, sha256, size })).sort((left, right) => left.key.localeCompare(right.key));
  if (manifestKeys.length !== inventoryKeys.length || manifestKeys.some((key, index) => key !== inventoryKeys[index]) || JSON.stringify(recordedObjects) !== JSON.stringify(frozenObjects)) throw new Error("Preparation manifest and inventory evidence disagree.");
  if ((await lstat(files.assetsRoot)).isSymbolicLink()) throw new Error("Symlink assetsRoot is not allowed.");
  for (const item of inventory) {
    const productSlug = item.key.split("/")[1]!;
    const productsRoot = resolve(files.assetsRoot, "products");
    const productRoot = resolve(productsRoot, productSlug);
    const assetPath = localAssetPath(files.assetsRoot, item.key);
    if ((await lstat(productsRoot)).isSymbolicLink() || (await lstat(productRoot)).isSymbolicLink() || (await lstat(assetPath)).isSymbolicLink()) throw new Error("Symlink local asset path is not allowed.");
    const bytes = await readFile(assetPath);
    if (bytes.byteLength !== item.size || digest(bytes) !== item.sha256) throw new Error(`Prepared local asset integrity mismatch: ${item.key}`);
    validateWebpBytes(bytes, "image/webp");
  }
  if (run.results["fixture"] === true || run.results["sourceType"] === "fixture") throw new Error("Fixture-only sources are not valid operational inputs.");
  return { runId, environment, destinationFingerprint, manifestSha256, expectedCount, runRoot, runDirectory, ...files, run };
}

export function redactOperationalError(): string { return "OPERATIONAL_COMMAND_FAILED"; }
