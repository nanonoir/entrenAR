import { readFile } from "node:fs/promises";
import { parseOperationalArgs, redactOperationalError } from "./operations/run-binding";
import { runBoundCategorySync } from "./category-sync.command";
import { identifyDatabaseTarget } from "./operations/database-target";

export interface HandoffDependencies { sync?: (runId: string, root: string, confirmedFingerprint?: string) => Promise<unknown>; databaseFingerprint?: () => string; output?: (value: unknown) => void }

export async function runOperationalHandoff(argv: readonly string[], dependencies: HandoffDependencies = {}): Promise<number> {
  try {
    const binding = await parseOperationalArgs(argv);
    const confirmationIndex = argv.findIndex((argument) => argument === "--confirm-db-fingerprint");
    const confirmedFingerprint = confirmationIndex >= 0 ? argv[confirmationIndex + 1] : undefined;
    if (!confirmedFingerprint || !/^[a-f0-9]{64}$/.test(confirmedFingerprint)) throw new Error("Database target confirmation is required.");
    const currentFingerprint = (dependencies.databaseFingerprint ?? (() => identifyDatabaseTarget().fingerprint))();
    if (confirmedFingerprint !== currentFingerprint) throw new Error("Database target does not match confirmation.");
    await readFile(binding.categoriesPath);
    await readFile(binding.manifestPath);
    await readFile(binding.inventoryPath);
    const result = await (dependencies.sync ?? ((runId, root, fingerprint) => runBoundCategorySync(runId, root, fingerprint)))(binding.runId, binding.runRoot, confirmedFingerprint);
    dependencies.output?.({ ok: true, code: "CATEGORIES_SYNCED", runId: binding.runId, result });
    return 0;
  } catch { dependencies.output?.({ ok: false, code: redactOperationalError() }); return 2; }
}
