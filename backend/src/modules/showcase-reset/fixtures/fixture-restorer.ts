import type { Prisma } from "../../../generated/prisma/client";
import type { ShowcaseResetReport } from "../showcase-reset.report";
import type { ShowcaseFixtureFamilyName } from "./showcase-fixture-manifest";

interface FixtureRestorer {
  readonly family: ShowcaseFixtureFamilyName;

  restore(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void>;
}

export type { FixtureRestorer };
