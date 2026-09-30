import "dotenv/config";
import { readR2Environment } from "./storage/r2-storage";
import { S3R2StorageAdapter } from "./storage/s3-r2-storage.adapter";
import { runPreflightCommand } from "./preflight.command";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../common/prisma/prisma.service";

async function main(): Promise<void> {
  let application: INestApplicationContext | undefined;
  try {
    const environment = readR2Environment();
    application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const prisma = application.get(PrismaService);
    const [categories, productCount] = await Promise.all([
      prisma.category.findMany({ select: { slug: true } }),
      prisma.product.count(),
    ]);
    process.exitCode = await runPreflightCommand(process.argv.slice(2), {
      storage: new S3R2StorageAdapter({ environment }),
      categorySlugs: new Set(categories.map((category) => category.slug)),
      productCount,
      output: (value) => process.stdout.write(`${JSON.stringify(value)}\n`),
    });
  } catch {
    process.stdout.write(JSON.stringify({ ok: false, code: "PREFLIGHT_CONFIGURATION_FAILED" }) + "\n");
    process.exitCode = 2;
  } finally {
    await application?.close();
  }
}

void main();
