const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const RECONCILE_LEASE_SECONDS = 30;
export const FINANCIAL_RECONCILE_INTERVAL_MS = 24 * HOUR;

/** Age thresholds (from the attempt submission, challenge creation, review start) used by cadence and attention. */
export const PAYMENT_THRESHOLDS = {
  challengeLifetimeMs: 40 * MINUTE,
  reviewAlertMs: 24 * HOUR,
  reviewAttentionMs: HOUR,
  unknownAlertMs: MINUTE,
  unknownAttentionMs: 30 * MINUTE,
} as const;

export interface PendingCadenceInput {
  /** Milliseconds since the attempt was submitted. */
  attemptAgeMs: number;
  /** Milliseconds since the provider reported the order as under review, when it is. */
  reviewAgeMs?: number | undefined;
}

/**
 * Delay until the next authoritative read of an unsettled attempt: 30 s for the first 5 minutes, 2 minutes until
 * the 40-minute challenge window ends, then 5 minutes. Reviews older than 24 hours poll every 15 minutes.
 */
export function pendingReconcileDelayMs({ attemptAgeMs, reviewAgeMs }: PendingCadenceInput): number {
  if (reviewAgeMs !== undefined && reviewAgeMs >= PAYMENT_THRESHOLDS.reviewAlertMs) return 15 * MINUTE;
  if (attemptAgeMs < 5 * MINUTE) return 30 * SECOND;
  if (attemptAgeMs < PAYMENT_THRESHOLDS.challengeLifetimeMs) return 2 * MINUTE;
  return 5 * MINUTE;
}

/** True once the retry deadline is reached: `retryUntil <= now`, with the database clock as `now`. */
export function isRetryWindowExpired(retryUntil: Date | null, databaseNow: Date): boolean {
  return retryUntil !== null && retryUntil.getTime() <= databaseNow.getTime();
}

/** Bounded-concurrency map: at most `limit` calls in flight (provider HTTP concurrency cap). */
export async function mapWithLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
