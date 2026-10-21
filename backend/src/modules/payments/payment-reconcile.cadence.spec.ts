import {
  PAYMENT_THRESHOLDS,
  isRetryWindowExpired,
  mapWithLimit,
  pendingReconcileDelayMs,
} from "./payment-reconcile.cadence";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

describe("pendingReconcileDelayMs", () => {
  it.each([
    [0, 30 * SECOND],
    [5 * MINUTE - 1, 30 * SECOND],
    [5 * MINUTE, 2 * MINUTE],
    [40 * MINUTE - 1, 2 * MINUTE],
    [40 * MINUTE, 5 * MINUTE],
    [3 * 60 * MINUTE, 5 * MINUTE],
  ])("polls an attempt aged %d ms every %d ms", (attemptAgeMs, expected) => {
    expect(pendingReconcileDelayMs({ attemptAgeMs })).toBe(expected);
  });

  it("polls reviews older than 24 hours every 15 minutes, regardless of attempt age", () => {
    const day = PAYMENT_THRESHOLDS.reviewAlertMs;
    expect(pendingReconcileDelayMs({ attemptAgeMs: day + MINUTE, reviewAgeMs: day - 1 })).toBe(5 * MINUTE);
    expect(pendingReconcileDelayMs({ attemptAgeMs: day + MINUTE, reviewAgeMs: day })).toBe(15 * MINUTE);
  });
});

describe("isRetryWindowExpired", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");

  it("expires exactly at the deadline and never before", () => {
    expect(isRetryWindowExpired(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isRetryWindowExpired(new Date(now.getTime()), now)).toBe(true);
    expect(isRetryWindowExpired(new Date(now.getTime() - 1), now)).toBe(true);
  });

  it("never expires without a deadline", () => {
    expect(isRetryWindowExpired(null, now)).toBe(false);
  });
});

describe("mapWithLimit", () => {
  it("keeps results in order and never exceeds the concurrency cap", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
