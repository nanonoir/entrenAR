import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { readFile } from "node:fs/promises";

import { CatalogImportService } from "./catalog-import.service";

export const CATALOG_IMPORT_EXIT_CODE = { SUCCESS: 0, REPORT_FAILURE: 2, UNEXPECTED_FAILURE: 1 } as const;

export async function runCatalogImportCommand(filePath = process.argv[2]): Promise<number> {
  let application: INestApplicationContext | undefined;
  try {
    if (!filePath) {
      process.stdout.write(JSON.stringify({ ok: false, issues: [{ code: "MISSING_INPUT", message: "A manifest path is required." }] }) + "\n");
      return CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
    }
    const raw = await readFile(filePath, "utf8");
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      process.stdout.write(JSON.stringify({ ok: false, issues: [{ code: "INVALID_JSON", message: "The manifest is not valid JSON." }] }) + "\n");
      return CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
    }
    const { AppModule } = await import("../../app.module");
    application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const report = await application.get(CatalogImportService).importCatalog(input);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report.ok ? CATALOG_IMPORT_EXIT_CODE.SUCCESS : CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE;
  } catch {
    process.stdout.write(JSON.stringify({ ok: false, issues: [{ code: "UNEXPECTED_FAILURE", message: "Catalog import could not be completed." }] }) + "\n");
    return CATALOG_IMPORT_EXIT_CODE.UNEXPECTED_FAILURE;
  } finally {
    await application?.close();
  }
}
