import { readFile } from "node:fs/promises";
import { parseOperationalArgs, redactOperationalError } from "./operations/run-binding";
import { verifyExactSet, type R2StoragePort } from "./storage/r2-storage";
import { digest, RunStore, RUN_STATUS } from "./run/run-store";
import { identifyDatabaseTarget } from "./operations/database-target";

export interface PreflightCommandDependencies { storage: R2StoragePort; categorySlugs: ReadonlySet<string>; productCount: number; databaseFingerprint?: () => string; output?: (value: unknown) => void }

export async function runPreflightCommand(argv: readonly string[], dependencies: PreflightCommandDependencies): Promise<number> {
  try {
    const binding = await parseOperationalArgs(argv, { verifyFrozenDigests: false, verifyManifestApproval: false });
    const r2Fingerprint = dependencies.storage.destinationFingerprint?.();
    const confirmIndex = argv.findIndex((argument) => argument === "--confirm-db-fingerprint");
    const confirmedFingerprint = confirmIndex >= 0 ? argv[confirmIndex + 1] : undefined;
    const targetFingerprint = (dependencies.databaseFingerprint ?? (() => identifyDatabaseTarget().fingerprint))();
    const manifestBytes = await readFile(binding.manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as { products?: Array<{ categorySlugs?: string[] }> };
    const blockers: string[] = [];
    const databaseConfirmed = Boolean(confirmedFingerprint && /^[a-f0-9]{64}$/.test(confirmedFingerprint) && confirmedFingerprint === targetFingerprint && binding.run.targetFingerprint === targetFingerprint);
    if (!databaseConfirmed) blockers.push("TARGET_MISMATCH");
    const r2Confirmed = Boolean(r2Fingerprint && r2Fingerprint === binding.destinationFingerprint && binding.run.r2DestinationFingerprint === binding.destinationFingerprint);
    if (!r2Confirmed) blockers.push("R2_DESTINATION_MISMATCH");
    if (binding.run.manifestSha256 !== binding.manifestSha256) blockers.push("MANIFEST_APPROVAL_MISMATCH");
    for (const fileName of ["source.json", "taxonomy.json", "categories.json", "products.json", "inventory.json", "report.md"]) {
      const expectedDigest = binding.run.fileDigests?.[fileName];
      if (!expectedDigest || digest(await readFile(new RunStore(binding.runRoot).path(binding.runId, fileName))) !== expectedDigest) {
        blockers.push("FROZEN_FILE_DIGEST_CHANGED");
        break;
      }
    }
    if (![RUN_STATUS.CATEGORIES_SYNCED, RUN_STATUS.READY].includes(binding.run.status as typeof RUN_STATUS.CATEGORIES_SYNCED)) blockers.push("RUN_NOT_CATEGORY_SYNCED");
    if (dependencies.productCount !== 0) blockers.push("TARGET_NOT_CLEAN");
    for (const product of manifest.products ?? []) for (const category of product.categorySlugs ?? []) if (!dependencies.categorySlugs.has(category)) blockers.push("UNKNOWN_CATEGORY");
    const inventory = JSON.parse(await readFile(binding.inventoryPath, "utf8")) as Array<{ key: string; size: number; sha256: string }>;
    if (r2Confirmed) {
      try { await verifyExactSet(dependencies.storage, inventory, true); } catch { blockers.push("R2_EXACT_SET_FAILED"); }
    }
    if (digest(manifestBytes) !== binding.manifestSha256) blockers.push("MANIFEST_CHANGED");
    const store = new RunStore(binding.runRoot);
    const persisted = await store.recordPreflight(binding.runId, {
      ok: blockers.length === 0,
      targetFingerprint,
      blockers,
      expectedCount: inventory.length,
    });
    if (persisted.blockers.length) blockers.splice(0, blockers.length, ...persisted.blockers);
    dependencies.output?.({ ok: blockers.length === 0, code: blockers.length ? "PREFLIGHT_BLOCKED" : "PREFLIGHT_READY", runId: binding.runId, blockers, expectedCount: inventory.length });
    return blockers.length ? 2 : 0;
  } catch { dependencies.output?.({ ok: false, code: redactOperationalError() }); return 2; }
}

export function createPreflightStore(root: string): RunStore { return new RunStore(root); }
