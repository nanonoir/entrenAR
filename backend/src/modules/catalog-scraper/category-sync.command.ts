import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "../../app.module";
import { CatalogTaxonomySyncService } from "./taxonomy";
import { RunStore, digest, RUN_STATUS } from "./run/run-store";
import { identifyDatabaseTarget } from "./operations/database-target";

export async function runCatalogCategorySyncCommand(filePath = process.argv[2]): Promise<number> {
  let application: INestApplicationContext | undefined;
  try {
    if (!filePath) { process.stdout.write(JSON.stringify({ ok: false, code: "MISSING_INPUT" }) + "\n"); return 2; }
    const input = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const result = await application.get(CatalogTaxonomySyncService).sync(input);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    return 0;
  } catch { process.stdout.write(JSON.stringify({ ok: false, code: "SYNC_FAILED" }) + "\n"); return 2; }
  finally { await application?.close(); }
}

export interface BoundCategorySyncDependencies {
  databaseFingerprint?: () => string;
  sync?: (input: unknown) => Promise<{ created: number; updated: number; unchanged: number }>;
}

export async function runBoundCategorySync(runId: string, root = "scrape-output", confirmedFingerprint?: string, dependencies: BoundCategorySyncDependencies = {}): Promise<{ created: number; updated: number; unchanged: number; conflicts: number }> {
  const store = new RunStore(root); const run = await store.load(runId);
  const allowed = new Set([RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED]);
  if (!(allowed as Set<string>).has(run.status)) throw new Error("Category sync requires a frozen run.");
  if (!run.r2DestinationFingerprint) throw new Error("The run has no verified R2 destination claim.");
  const currentFingerprint = dependencies.databaseFingerprint ?? (() => identifyDatabaseTarget().fingerprint);
  if (!confirmedFingerprint || currentFingerprint() !== confirmedFingerprint) throw new Error("Database target does not match confirmation.");
  if (run.targetFingerprint && run.targetFingerprint !== confirmedFingerprint) throw new Error("Run is already bound to a different database target.");
  const categoriesPath = store.path(runId, "categories.json"); const bytes = await readFile(categoriesPath); const input = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!run.fileDigests?.["categories.json"] || digest(bytes) !== run.fileDigests["categories.json"]) throw new Error("Frozen categories digest does not match the selected run.");
  await store.claimTarget(runId, confirmedFingerprint);
  let application: INestApplicationContext | undefined;
  try {
    if (dependencies.sync) {
      if (currentFingerprint() !== confirmedFingerprint) throw new Error("Database target changed before synchronization.");
    } else {
      application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
      if (currentFingerprint() !== confirmedFingerprint) throw new Error("Database target changed before synchronization.");
    }
    const result = await (dependencies.sync ?? ((value) => application!.get(CatalogTaxonomySyncService).sync(value)))(input);
    const counts = { ...result, conflicts: 0 };
    await store.recordCategorySync(runId, confirmedFingerprint, counts);
    return counts;
  } catch (error) {
    await store.recordCategorySyncFailure(runId);
    throw error;
  } finally { await application?.close(); }
}
