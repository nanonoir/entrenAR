import "reflect-metadata";
import "dotenv/config";

import { PrismaService } from "../../common/prisma/prisma.service";
import { reportDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { planVariantNameNormalization } from "./variant-name-normalization";

/** Dry-run by default; `--apply` renames placeholder variant names only (never sku, stock or prices). */
async function run(): Promise<number> {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaService();

  try {
    const variants = await prisma.productVariant.findMany({
      select: { attributes: true, id: true, name: true, product: { select: { name: true, variantProperties: true } }, sku: true },
    });
    const plan = planVariantNameNormalization(variants.map((variant) => ({
      attributes: variant.attributes,
      id: variant.id,
      name: variant.name,
      productName: variant.product.name,
      sku: variant.sku,
      variantProperties: variant.product.variantProperties,
    })));
    let updated = 0;

    if (apply) {
      await prisma.$transaction(async (transaction) => {
        for (const change of plan.changes) {
          // The guard on the current name keeps the update idempotent and safe against concurrent edits.
          const result = await transaction.productVariant.updateMany({ data: { name: change.to }, where: { id: change.id, name: change.from } });
          updated += result.count;
        }
      }, { timeout: 120_000 });
    }

    process.stdout.write(`${JSON.stringify({
      applied: apply,
      customNames: plan.customNames,
      pending: plan.changes.length,
      sample: plan.changes.slice(0, 10),
      target: reportDatabaseTarget(),
      total: variants.length,
      unresolved: plan.unresolved.length,
      updated,
    }, null, 2)}\n`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

run().then((code) => { process.exitCode = code; }, (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Variant name normalization failed."}\n`);
  process.exitCode = 1;
});
