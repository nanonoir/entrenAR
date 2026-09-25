import type { ShowcaseFixtureFamilyName } from "./fixtures/showcase-fixture-manifest";

const SHOWCASE_RESET_FAILURE_CATEGORY = {
  LOCK_TIMEOUT: "lock_timeout",
  MUTEX_HELD: "mutex_held",
  RESTORATION_FAILED: "restoration_failed",
  UNEXPECTED: "unexpected",
} as const;

const SHOWCASE_RESET_OUTCOME = {
  FAILED: "failed",
  SKIPPED: "skipped",
  SUCCEEDED: "succeeded",
} as const;

const SHOWCASE_RESET_LOCK_STATE = {
  ACQUIRED: "acquired",
  HELD: "held",
  TIMED_OUT: "timed_out",
  UNAVAILABLE: "unavailable",
} as const;

type ShowcaseResetFailureCategory = (typeof SHOWCASE_RESET_FAILURE_CATEGORY)[keyof typeof SHOWCASE_RESET_FAILURE_CATEGORY];
type ShowcaseResetOutcome = (typeof SHOWCASE_RESET_OUTCOME)[keyof typeof SHOWCASE_RESET_OUTCOME];
type ShowcaseResetLockState = (typeof SHOWCASE_RESET_LOCK_STATE)[keyof typeof SHOWCASE_RESET_LOCK_STATE];

interface ShowcaseResetFamilyCounts {
  created: number;
  preserved: number;
  updated: number;
}

interface ShowcaseResetFamilyReport extends ShowcaseResetFamilyCounts {
  name: ShowcaseFixtureFamilyName;
}

interface ShowcaseResetReportOutput {
  durationMs: number;
  failureCategory?: ShowcaseResetFailureCategory;
  families: readonly ShowcaseResetFamilyReport[];
  lockState: ShowcaseResetLockState;
  outcome: ShowcaseResetOutcome;
  runId: string;
}

class ShowcaseResetReport {
  private readonly families = new Map<ShowcaseFixtureFamilyName, ShowcaseResetFamilyCounts>();
  private readonly startedAt = Date.now();

  constructor(private readonly runId: string) {}

  recordFailure(_error: unknown): void {
    // Deliberately discard raw error details: they may contain PII or credentials.
  }

  recordFamily(family: ShowcaseFixtureFamilyName, counts: ShowcaseResetFamilyCounts): void {
    this.families.set(family, { ...counts });
  }

  complete(outcome: ShowcaseResetOutcome, failureCategory?: ShowcaseResetFailureCategory): ShowcaseResetReportOutput {
    const families = [...this.families.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, counts]) => ({ name, ...counts }));

    return {
      durationMs: Math.max(0, Date.now() - this.startedAt),
      ...(failureCategory === undefined ? {} : { failureCategory }),
      families,
      lockState: this.lockStateFor(outcome, failureCategory),
      outcome,
      runId: this.runId,
    };
  }

  private lockStateFor(outcome: ShowcaseResetOutcome, failureCategory?: ShowcaseResetFailureCategory): ShowcaseResetLockState {
    if (failureCategory === SHOWCASE_RESET_FAILURE_CATEGORY.MUTEX_HELD) return SHOWCASE_RESET_LOCK_STATE.HELD;
    if (failureCategory === SHOWCASE_RESET_FAILURE_CATEGORY.LOCK_TIMEOUT) return SHOWCASE_RESET_LOCK_STATE.TIMED_OUT;
    return outcome === SHOWCASE_RESET_OUTCOME.SUCCEEDED ? SHOWCASE_RESET_LOCK_STATE.ACQUIRED : SHOWCASE_RESET_LOCK_STATE.UNAVAILABLE;
  }
}

export {
  SHOWCASE_RESET_FAILURE_CATEGORY,
  SHOWCASE_RESET_LOCK_STATE,
  SHOWCASE_RESET_OUTCOME,
  ShowcaseResetReport,
};
export type {
  ShowcaseResetFailureCategory,
  ShowcaseResetFamilyCounts,
  ShowcaseResetFamilyReport,
  ShowcaseResetLockState,
  ShowcaseResetOutcome,
  ShowcaseResetReportOutput,
};
