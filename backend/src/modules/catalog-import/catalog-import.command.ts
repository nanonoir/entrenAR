import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { readFile } from "node:fs/promises";

import { CatalogImportService } from "./catalog-import.service";
import { assertManifestApproval, parseImportApproval, type ImportAssetReadinessPort, type ImportTargetPort } from "./approval";
import { PrismaService } from "../../common/prisma/prisma.service";
import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { RunStore, RUN_STATUS } from "../catalog-scraper/run/run-store";
import { readR2Environment, verifyExactSet } from "../catalog-scraper/storage/r2-storage";
import { S3R2StorageAdapter } from "../catalog-scraper/storage/s3-r2-storage.adapter";

export interface CatalogImportCommandDependencies {
  argv?: readonly string[];
  service?: Pick<CatalogImportService, "importCatalog">;
  target?: ImportTargetPort;
  assets?: ImportAssetReadinessPort;
  output?: (value: unknown) => void;
}

export const CATALOG_IMPORT_EXIT_CODE = { SUCCESS: 0, REPORT_FAILURE: 2, UNEXPECTED_FAILURE: 1 } as const;

export async function runCatalogImportCommand(filePath = process.argv[2], dependencies: CatalogImportCommandDependencies = {}): Promise<number> {
  let application: INestApplicationContext | undefined;
  const output = dependencies.output ?? ((value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`));
  try {
    if (!filePath) {
      output({ ok: false, issues: [{ code: "MISSING_INPUT", message: "A manifest path is required." }] });
      return CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
    }
    const parsed = parseImportApproval(dependencies.argv ?? process.argv.slice(2));
    filePath = parsed.filePath;
    const runStore = new RunStore(parsed.approval.runRoot);
    const raw = await readFile(filePath, "utf8");
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      output({ ok: false, issues: [{ code: "INVALID_JSON", message: "The manifest is not valid JSON." }] });
      return CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
    }
    let service = dependencies.service;
    let target = dependencies.target;
    let assets = dependencies.assets;
    if (service || target || assets) {
      if (!service || !target || !assets) throw new Error("Import test dependencies are incomplete.");
    } else {
      const { AppModule } = await import("../../app.module");
      application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
      const prisma = application.get(PrismaService);
      const r2Storage = new S3R2StorageAdapter({ environment: readR2Environment() });
      service = application.get(CatalogImportService);
      target = { environmentFingerprint: async () => identifyDatabaseTarget().fingerprint, productCount: () => prisma.product.count() };
      assets = { destinationFingerprint: () => r2Storage.destinationFingerprint(), verify: (expected) => verifyExactSet(r2Storage, expected, true) };
    }
    if (!service || !target || !assets) throw new Error("Import command dependencies are incomplete.");
    await assertManifestApproval(filePath, parsed.approval, target, assets);
    await runStore.transition(parsed.approval.runId, RUN_STATUS.IMPORTING, { blockers: [] });
    const report = await service.importCatalog(input, parsed.approval.runId);
    if (report.ok) {
      try {
        if (!report.counts) throw new Error("Import completed without committed counts.");
        await runStore.recordImportOutcome(parsed.approval.runId, {
          targetFingerprint: parsed.approval.environment,
          manifestSha256: parsed.approval.manifestSha256,
          counts: report.counts,
        });
      } catch {
        await runStore.transition(parsed.approval.runId, RUN_STATUS.RECONCILIATION_REQUIRED, { blockers: ["IMPORT_RECEIPT_RECONCILIATION_REQUIRED"] }).catch(() => undefined);
        output({ ok: false, code: "RECONCILIATION_REQUIRED", runId: parsed.approval.runId });
        return CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE;
      }
    } else {
      const indeterminate = report.issues?.some((issue) => issue.code === "PERSISTENCE_FAILURE") ?? false;
      await runStore.transition(
        parsed.approval.runId,
        indeterminate ? RUN_STATUS.RECONCILIATION_REQUIRED : RUN_STATUS.FAILED,
        { blockers: [indeterminate ? "IMPORT_OUTCOME_RECONCILIATION_REQUIRED" : "IMPORT_FAILED"] },
      );
      if (indeterminate) {
        output({ ok: false, code: "RECONCILIATION_REQUIRED", runId: parsed.approval.runId });
        return CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE;
      }
    }
    output(report);
    return report.ok ? CATALOG_IMPORT_EXIT_CODE.SUCCESS : CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
  } catch {
    output({ ok: false, issues: [{ code: "UNEXPECTED_FAILURE", message: "Catalog import could not be completed." }] });
    return CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE;
  } finally {
    await application?.close();
  }
}
