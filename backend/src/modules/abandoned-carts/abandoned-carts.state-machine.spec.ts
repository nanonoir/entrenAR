import { CheckoutRecoveryStatus, CheckoutSessionStatus } from "../../generated/prisma/enums";
import {
  RECOVERY_STATUS,
  RECOVERY_TIMING,
} from "./abandoned-carts.schemas";
import {
  RECOVERY_TIMING_THRESHOLD_MS,
  RecoveryTransitionError,
  assertRecoveryTransition,
  canTransitionRecoveryStatus,
  isSessionAbandoned,
  resolveTimingThresholdMs,
} from "./abandoned-carts.state-machine";

describe("abandoned-cart state machine", () => {
  afterEach(() => jest.restoreAllMocks());

  it("classifies only stale active sessions as abandoned", () => {
    const now = new Date("2026-09-05T12:00:00.000Z").getTime();
    jest.spyOn(Date, "now").mockReturnValue(now);
    const threshold = resolveTimingThresholdMs(RECOVERY_TIMING.TWENTY_FOUR_HOURS);

    expect(isSessionAbandoned(new Date(now - threshold - 1), threshold, CheckoutSessionStatus.ACTIVE)).toBe(true);
    expect(isSessionAbandoned(new Date(now - threshold), threshold, CheckoutSessionStatus.ACTIVE)).toBe(false);
    expect(isSessionAbandoned(new Date(now - threshold + 1), threshold, CheckoutSessionStatus.ACTIVE)).toBe(false);
    expect(isSessionAbandoned(new Date(now - threshold - 1), threshold, CheckoutSessionStatus.COMPLETED)).toBe(false);
    expect(isSessionAbandoned(new Date("invalid"), threshold, CheckoutSessionStatus.ACTIVE)).toBe(false);
  });

  it("resolves every configured recovery timing in milliseconds", () => {
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.SIX_HOURS)).toBe(6 * 60 * 60 * 1_000);
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.TWENTY_FOUR_HOURS)).toBe(24 * 60 * 60 * 1_000);
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.THREE_DAYS)).toBe(3 * 24 * 60 * 60 * 1_000);
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.SEVEN_DAYS)).toBe(7 * 24 * 60 * 60 * 1_000);
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.FOURTEEN_DAYS)).toBe(14 * 24 * 60 * 60 * 1_000);
    expect(resolveTimingThresholdMs(RECOVERY_TIMING.MANUAL)).toBe(60 * 60 * 1_000);
    expect(RECOVERY_TIMING_THRESHOLD_MS[RECOVERY_TIMING.MANUAL]).toBe(60 * 60 * 1_000);
    expect(() => resolveTimingThresholdMs("invalid" as never)).toThrow("Unsupported recovery timing");
  });

  it("enforces the recovery transition matrix", () => {
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.PENDING, RECOVERY_STATUS.SENT)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.PENDING, RECOVERY_STATUS.MANUAL)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.PENDING, RECOVERY_STATUS.RECOVERED)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.PENDING, RECOVERY_STATUS.DISCARDED)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.SENT, RECOVERY_STATUS.SENT)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.SENT, RECOVERY_STATUS.MANUAL)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.SENT)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.RECOVERED)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.DISCARDED)).toBe(true);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.PENDING, RECOVERY_STATUS.PENDING)).toBe(false);
    expect(canTransitionRecoveryStatus(RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.MANUAL)).toBe(false);
  });

  it("rejects every transition out of terminal recovery states", () => {
    const terminalStatuses = [CheckoutRecoveryStatus.RECOVERED, CheckoutRecoveryStatus.DISCARDED] as const;
    const targetStatuses = [
      CheckoutRecoveryStatus.PENDING,
      CheckoutRecoveryStatus.SENT,
      CheckoutRecoveryStatus.MANUAL,
      CheckoutRecoveryStatus.RECOVERED,
      CheckoutRecoveryStatus.DISCARDED,
    ] as const;

    for (const currentStatus of terminalStatuses) {
      for (const targetStatus of targetStatuses) {
        expect(canTransitionRecoveryStatus(currentStatus, targetStatus)).toBe(false);
        expect(() => assertRecoveryTransition(currentStatus, targetStatus)).toThrow(RecoveryTransitionError);
      }
    }
  });

  it("reports the rejected transition in the domain error", () => {
    expect(() => assertRecoveryTransition(CheckoutRecoveryStatus.RECOVERED, CheckoutRecoveryStatus.SENT))
      .toThrow("Recovery status cannot transition from RECOVERED to SENT.");
  });
});
