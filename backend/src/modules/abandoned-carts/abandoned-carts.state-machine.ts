import { CheckoutRecoveryStatus, CheckoutSessionStatus } from "../../generated/prisma/enums";
import {
  RECOVERY_STATUS,
  RECOVERY_TIMING,
  type RecoveryStatus,
  type RecoveryTiming,
} from "./abandoned-carts.schemas";

const HOUR_MS = 60 * 60 * 1_000;

export const RECOVERY_TIMING_THRESHOLD_MS: Record<RecoveryTiming, number> = {
  [RECOVERY_TIMING.FOURTEEN_DAYS]: 14 * 24 * HOUR_MS,
  [RECOVERY_TIMING.THREE_DAYS]: 3 * 24 * HOUR_MS,
  [RECOVERY_TIMING.SIX_HOURS]: 6 * HOUR_MS,
  [RECOVERY_TIMING.SEVEN_DAYS]: 7 * 24 * HOUR_MS,
  [RECOVERY_TIMING.TWENTY_FOUR_HOURS]: 24 * HOUR_MS,
  [RECOVERY_TIMING.MANUAL]: HOUR_MS,
};

const ALLOWED_RECOVERY_TRANSITIONS: Record<RecoveryStatus, readonly RecoveryStatus[]> = {
  [RECOVERY_STATUS.DISCARDED]: [],
  [RECOVERY_STATUS.MANUAL]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
  [RECOVERY_STATUS.PENDING]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
  [RECOVERY_STATUS.RECOVERED]: [],
  [RECOVERY_STATUS.SENT]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
};

export class RecoveryTransitionError extends Error {
  constructor(
    public readonly currentStatus: RecoveryStatus,
    public readonly targetStatus: RecoveryStatus,
  ) {
    super(`Recovery status cannot transition from ${currentStatus} to ${targetStatus}.`);
    this.name = "RecoveryTransitionError";
  }
}

export function isSessionAbandoned(
  lastActivityAt: Date,
  thresholdMs: number,
  status: CheckoutSessionStatus,
  now = new Date(Date.now()),
): boolean {
  if (status !== CheckoutSessionStatus.ACTIVE || !Number.isFinite(thresholdMs) || thresholdMs < 0) return false;
  if (!(lastActivityAt instanceof Date) || Number.isNaN(lastActivityAt.getTime())) return false;
  return now.getTime() - lastActivityAt.getTime() > thresholdMs;
}

export function canTransitionRecoveryStatus(
  currentStatus: RecoveryStatus,
  targetStatus: RecoveryStatus,
): boolean {
  return ALLOWED_RECOVERY_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export function assertRecoveryTransition(
  currentStatus: RecoveryStatus,
  targetStatus: RecoveryStatus,
): void {
  if (!canTransitionRecoveryStatus(currentStatus, targetStatus)) {
    throw new RecoveryTransitionError(currentStatus, targetStatus);
  }
}

export function resolveTimingThresholdMs(timing: RecoveryTiming): number {
  const threshold = RECOVERY_TIMING_THRESHOLD_MS[timing];
  if (threshold === undefined) throw new Error(`Unsupported recovery timing: ${String(timing)}.`);
  return threshold;
}

export const canTransition = canTransitionRecoveryStatus;
export const assertTransition = assertRecoveryTransition;

export { CheckoutRecoveryStatus };
