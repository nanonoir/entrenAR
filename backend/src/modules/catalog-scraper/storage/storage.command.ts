import { readFile } from "node:fs/promises";
import { parseOperationalArgs, redactOperationalError } from "../operations/run-binding";
import { listAll, resetProductsPrefix, uploadExactSet, verifyExactSet, type R2StoragePort } from "./r2-storage";
import { localAssetPath } from "./local-assets";
import { RunStore } from "../run/run-store";

export interface StorageCommandDependencies { storage: R2StoragePort; output?: (value: unknown) => void }

export async function runStorageCommand(mode: "reset" | "upload" | "reconcile", argv: readonly string[], dependencies: StorageCommandDependencies): Promise<number> {
  try {
    const binding = await parseOperationalArgs(argv, { requirePrefix: true });
    const destinationFingerprint = dependencies.storage.destinationFingerprint?.();
    if (!destinationFingerprint || destinationFingerprint !== binding.destinationFingerprint) throw new Error("R2 destination fingerprint does not match confirmation.");
    if (mode === "reconcile") {
      const inventory = JSON.parse(await readFile(binding.inventoryPath, "utf8")) as Array<{ key: string; size: number; sha256: string }>;
      const store = new RunStore(binding.runRoot);
      try {
        await verifyExactSet(dependencies.storage, inventory, true);
      } catch (error) {
        await store.recordStorageVerificationFailure(binding.runId);
        throw error;
      }
      await store.recordVerifiedStorage(binding.runId, inventory.length, destinationFingerprint);
      dependencies.output?.({ ok: true, code: "R2_RECONCILED", runId: binding.runId, expectedCount: inventory.length });
      return 0;
    }
    if (mode === "reset") {
      if (binding.run.status !== "ASSETS_VALIDATED" || binding.run.stages.r2Reset === "ok") throw new Error("R2 reset is not allowed for this run stage.");
      await resetProductsPrefix(dependencies.storage, { runId: binding.runId, environment: binding.environment, destinationFingerprint, prefix: "products/", manifestSha256: binding.manifestSha256 });
      await new RunStore(binding.runRoot).recordR2Reset(binding.runId, destinationFingerprint);
      dependencies.output?.({ ok: true, code: "R2_RESET", runId: binding.runId, expectedCount: binding.expectedCount });
      return 0;
    }
    if (binding.run.status !== "R2_RESET" || binding.run.stages.r2Reset !== "ok") throw new Error("R2 upload requires a completed reset stage.");
    const inventory = JSON.parse(await readFile(binding.inventoryPath, "utf8")) as Array<{ key: string; size: number; sha256: string }>;
    const objects = await Promise.all(inventory.map(async (item) => ({ key: item.key, bytes: new Uint8Array(await readFile(localAssetPath(binding.assetsRoot, item.key))), contentType: "image/webp" })));
    await uploadExactSet(dependencies.storage, objects);
    await verifyExactSet(dependencies.storage, inventory, true);
    await new RunStore(binding.runRoot).recordR2Upload(binding.runId, destinationFingerprint, inventory.length);
    dependencies.output?.({ ok: true, code: "ASSETS_UPLOADED", runId: binding.runId, expectedCount: inventory.length });
    return 0;
  } catch { dependencies.output?.({ ok: false, code: redactOperationalError() }); return 2; }
}

export async function inspectStorage(dependencies: StorageCommandDependencies): Promise<number> { try { const objects = await listAll(dependencies.storage); dependencies.output?.({ ok: true, code: "R2_LIST", count: objects.length }); return 0; } catch { dependencies.output?.({ ok: false, code: redactOperationalError() }); return 2; } }
