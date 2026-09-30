import { readFile } from "node:fs/promises";
import { assertManifestReconciliation, parseImportApproval, type ImportTargetPort } from "./approval";
import { RunStore } from "../catalog-scraper/run/run-store";
import type { ImportReconciliation } from "./catalog-import.repository";

export interface ImportReconciliationCommandDependencies {
  target: ImportTargetPort;
  reconcile(input: unknown): Promise<ImportReconciliation>;
  output?: (value: unknown) => void;
}

export async function runCatalogImportReconciliation(
  argv: readonly string[] = process.argv.slice(2),
  dependencies?: ImportReconciliationCommandDependencies,
): Promise<number> {
  let close: (() => Promise<void>) | undefined;
  const output = dependencies?.output ?? ((value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`));
  try {
    const { filePath, approval } = parseImportApproval(argv);
    let resolvedDependencies = dependencies;
    if (!resolvedDependencies) {
      const { NestFactory } = await import("@nestjs/core");
      const { AppModule } = await import("../../app.module");
      const { PrismaService } = await import("../../common/prisma/prisma.service");
      const { CatalogImportService } = await import("./catalog-import.service");
      const { identifyDatabaseTarget } = await import("../catalog-scraper/operations/database-target");
      const application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
      close = () => application.close();
      const prisma = application.get(PrismaService);
      resolvedDependencies = {
        target: { environmentFingerprint: async () => identifyDatabaseTarget().fingerprint, productCount: async () => prisma.product.count() },
        reconcile: (input) => application.get(CatalogImportService).reconcile(input),
      };
    }
    await assertManifestReconciliation(filePath, approval, resolvedDependencies.target);
    const input = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const reconciliation = await resolvedDependencies.reconcile(input);
    if (!reconciliation.matches) {
      output({ ok: false, code: "RECONCILIATION_REQUIRED", runId: approval.runId, mismatches: reconciliation.mismatches });
      return 2;
    }
    await new RunStore(approval.runRoot).confirmReconciledImport(approval.runId, {
      targetFingerprint: approval.environment,
      manifestSha256: approval.manifestSha256,
      counts: reconciliation.counts,
      mismatches: reconciliation.mismatches,
    });
    output({ ok: true, code: "IMPORTED_RECONCILED", runId: approval.runId, counts: reconciliation.counts });
    return 0;
  } catch {
    output({ ok: false, code: "IMPORT_RECONCILIATION_FAILED" });
    return 2;
  } finally {
    await close?.();
  }
}
