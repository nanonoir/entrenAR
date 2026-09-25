import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { MutationGate } from "../../common/prisma/mutation-gate";
import { PrismaService } from "../../common/prisma/prisma.service";
import { InventoryRepository } from "../inventory/inventory.repository";
import type { FixtureRestorer } from "./fixtures/fixture-restorer";
import { ShowcaseInventoryReconciler } from "./inventory-reconciler";
import { SHOWCASE_RESET_FAILURE_CATEGORY, SHOWCASE_RESET_OUTCOME, ShowcaseResetReport, type ShowcaseResetReportOutput } from "./showcase-reset.report";
import { ShowcaseResetRunMutex } from "./showcase-reset.run-mutex";

const SHOWCASE_RESET_EXIT_CODE = {
  CONCURRENT_RUN: 20,
  LOCK_TIMEOUT: 21,
  FAILURE: 1,
  SUCCESS: 0,
} as const;
const SHOWCASE_RESET_RESTORERS = "showcase-reset-restorers";

interface ShowcaseResetRunResult {
  exitCode: (typeof SHOWCASE_RESET_EXIT_CODE)[keyof typeof SHOWCASE_RESET_EXIT_CODE];
  report: ShowcaseResetReportOutput;
}

@Injectable()
export class ShowcaseResetService {
  private readonly inventoryReconciler: ShowcaseInventoryReconciler;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationGate: MutationGate,
    private readonly runMutex: ShowcaseResetRunMutex,
    inventoryRepository: InventoryRepository,
    @Inject(SHOWCASE_RESET_RESTORERS)
    private readonly restorers: readonly FixtureRestorer[],
  ) {
    this.inventoryReconciler = new ShowcaseInventoryReconciler(inventoryRepository);
  }

  async run(): Promise<ShowcaseResetRunResult> {
    const runId = randomUUID();
    const report = new ShowcaseResetReport(runId);
    try {
      const mutexResult = await this.runMutex.run(async () => {
        await this.mutationGate.runExclusive(this.prisma, async (transaction) => {
          for (const restorer of this.restorers) await restorer.restore(transaction, report);
          await this.inventoryReconciler.reconcile(transaction, report, runId);
        });
      });
      if (!mutexResult.acquired) {
        return { exitCode: SHOWCASE_RESET_EXIT_CODE.CONCURRENT_RUN, report: report.complete(SHOWCASE_RESET_OUTCOME.SKIPPED, SHOWCASE_RESET_FAILURE_CATEGORY.MUTEX_HELD) };
      }
      return { exitCode: SHOWCASE_RESET_EXIT_CODE.SUCCESS, report: report.complete(SHOWCASE_RESET_OUTCOME.SUCCEEDED) };
    } catch (error) {
      report.recordFailure(error);
      const timedOut = isLockTimeout(error);
      return {
        exitCode: timedOut ? SHOWCASE_RESET_EXIT_CODE.LOCK_TIMEOUT : SHOWCASE_RESET_EXIT_CODE.FAILURE,
        report: report.complete(SHOWCASE_RESET_OUTCOME.FAILED, timedOut ? SHOWCASE_RESET_FAILURE_CATEGORY.LOCK_TIMEOUT : SHOWCASE_RESET_FAILURE_CATEGORY.RESTORATION_FAILED),
      };
    }
  }
}

function isLockTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("lock timeout");
}

export { SHOWCASE_RESET_EXIT_CODE, SHOWCASE_RESET_RESTORERS };
export type { ShowcaseResetRunResult };
