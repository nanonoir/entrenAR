import "reflect-metadata";
import "dotenv/config";

import { PrismaService } from "../../common/prisma/prisma.service";
import { reportDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { buildTariffPatchEntries, planTariffPatch } from "./shipping-tariff-patch";

/**
 * Dry-run by default; `--apply` updates only WeightBand.cost for the allow-listed band ids, in one transaction,
 * and only where the live value still equals the expected previous value. Never seeds or resets anything.
 */
async function run(): Promise<number> {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaService();

  try {
    const entries = buildTariffPatchEntries();
    const current = await prisma.weightBand.findMany({ select: { cost: true, id: true }, where: { id: { in: entries.map((entry) => entry.id) } } });
    const plan = planTariffPatch(entries, current.map((row) => ({ cost: row.cost.toString(), id: row.id })));
    let updated = 0;

    if (apply && !plan.safe) throw new Error("Refusing to apply: some bands are missing or hold an unexpected value (see dry-run output).");
    if (apply) {
      await prisma.$transaction(async (transaction) => {
        for (const row of plan.rows.filter((candidate) => candidate.action === "change")) {
          const result = await transaction.weightBand.updateMany({ data: { cost: row.target }, where: { cost: row.expectedCurrent, id: row.id } });
          if (result.count !== 1) throw new Error(`Band ${row.id} changed concurrently; transaction rolled back.`);
          updated += result.count;
        }
      }, { timeout: 30_000 });
    }

    process.stdout.write(`${JSON.stringify({ applied: apply, rows: plan.rows, safe: plan.safe, target: reportDatabaseTarget(), updated }, null, 2)}\n`);
    return plan.safe ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

run().then((code) => { process.exitCode = code; }, (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Shipping tariff patch failed."}\n`);
  process.exitCode = 1;
});
