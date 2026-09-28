import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "../../app.module";
import { CatalogTaxonomySyncService } from "./taxonomy";

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
