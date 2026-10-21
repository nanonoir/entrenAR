import { Logger } from "@nestjs/common";

import { PaymentAttemptStatus } from "../../generated/prisma/enums";
import {
  PAYMENT_EXPIRY_OVERDUE_MS,
  PAYMENT_SUBMISSION_STALLED_MS,
  PAYMENT_SWEEP_QUARANTINE_WINDOW_MS,
  PaymentAttentionService,
} from "./payment-attention.service";
import { PAYMENT_THRESHOLDS } from "./payment-reconcile.cadence";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

interface FindManyArgs {
  where: { status?: string; submittedAt?: { lt: Date }; challengeCreatedAt?: { lt: Date }; processedAt?: { gte: Date } };
}

function build(options: {
  attemptLeases?: number;
  challenges?: unknown[];
  flag?: boolean;
  notificationLeases?: number;
  overdue?: unknown[];
  quarantined?: unknown[];
  reviews?: unknown[];
  stalled?: unknown[];
  unknown?: unknown[];
} = {}) {
  const rows = (count = 0) => Array.from({ length: count }, () => ({}));
  const queryRaw = jest.fn()
    .mockResolvedValueOnce(rows(options.attemptLeases))
    .mockResolvedValueOnce(rows(options.notificationLeases));
  const attemptFindMany = jest.fn(async ({ where }: FindManyArgs) => {
    if (where.status === PaymentAttemptStatus.SUBMITTING) return options.stalled ?? [];
    if (where.status === PaymentAttemptStatus.UNKNOWN) return options.unknown ?? [];
    if (where.status === PaymentAttemptStatus.ACTION_REQUIRED) return options.challenges ?? [];
    return options.reviews ?? [];
  });
  const prisma = {
    $queryRaw: queryRaw,
    orderPayment: { findMany: jest.fn().mockResolvedValue(options.overdue ?? []) },
    paymentAttempt: { findMany: attemptFindMany },
    paymentNotification: { findMany: jest.fn().mockResolvedValue(options.quarantined ?? []) },
  };
  const repository = { databaseNow: jest.fn().mockResolvedValue(NOW) };
  const reducer = {
    flagAttention: jest.fn().mockResolvedValue(options.flag ?? true),
    markUnknown: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PaymentAttentionService(prisma as never, repository as never, reducer as never);
  return { attemptFindMany, prisma, reducer, service };
}

describe("PaymentAttentionService", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const alerts = () => warn.mock.calls.map(([message]) => JSON.parse(String(message)) as { count: number; event: string; ids: string[] });

  it("is quiet and zeroed when nothing is stuck", async () => {
    const { service } = build();

    await expect(service.sweep()).resolves.toEqual({
      attemptLeasesReclaimed: 0,
      challengesOverdue: 0,
      expiryOverdue: 0,
      flagged: 0,
      notificationLeasesReclaimed: 0,
      quarantinedRecent: 0,
      reviewsOverAlert: 0,
      stalledSubmissions: 0,
      unknownAlerts: 0,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("reclaims expired attempt and notification leases", async () => {
    const { service } = build({ attemptLeases: 2, notificationLeases: 3 });

    const summary = await service.sweep();

    expect(summary.attemptLeasesReclaimed).toBe(2);
    expect(summary.notificationLeasesReclaimed).toBe(3);
  });

  it("moves SUBMITTING attempts older than one minute to UNKNOWN", async () => {
    const { attemptFindMany, reducer, service } = build({ stalled: [{ id: "a1" }, { id: "a2" }] });

    const summary = await service.sweep();

    const query = attemptFindMany.mock.calls.find(([args]) => args.where.status === PaymentAttemptStatus.SUBMITTING)?.[0];
    expect(query?.where.submittedAt?.lt).toEqual(ago(PAYMENT_SUBMISSION_STALLED_MS));
    expect(PAYMENT_SUBMISSION_STALLED_MS).toBe(60_000);
    expect(reducer.markUnknown).toHaveBeenCalledWith("a1", { lastError: "submission_stalled" });
    expect(reducer.markUnknown).toHaveBeenCalledWith("a2", { lastError: "submission_stalled" });
    expect(summary.stalledSubmissions).toBe(2);
  });

  it("alerts UNKNOWN attempts older than one minute without flagging them yet", async () => {
    const { attemptFindMany, reducer, service } = build({
      unknown: [{ id: "u1", payment: { attentionRequiredAt: null }, providerOrderId: "ORD-SECRET", submittedAt: ago(5 * 60_000) }],
    });

    const summary = await service.sweep();

    const query = attemptFindMany.mock.calls.find(([args]) => args.where.status === PaymentAttemptStatus.UNKNOWN)?.[0];
    expect(query?.where.submittedAt?.lt).toEqual(ago(PAYMENT_THRESHOLDS.unknownAlertMs));
    expect(summary.unknownAlerts).toBe(1);
    expect(summary.flagged).toBe(0);
    expect(reducer.flagAttention).not.toHaveBeenCalled();
    expect(alerts()).toEqual([{ count: 1, event: "payment_unknown_outcome", ids: ["u1"] }]);
  });

  it("flags UNKNOWN attempts older than 30 minutes once, skipping already flagged payments", async () => {
    const { reducer, service } = build({
      unknown: [
        { id: "u1", payment: { attentionRequiredAt: null }, providerOrderId: null, submittedAt: ago(31 * 60_000) },
        { id: "u2", payment: { attentionRequiredAt: ago(1000) }, providerOrderId: null, submittedAt: ago(31 * 60_000) },
      ],
    });

    const summary = await service.sweep();

    expect(reducer.flagAttention).toHaveBeenCalledTimes(1);
    expect(reducer.flagAttention).toHaveBeenCalledWith("u1", "unresolved_unknown_outcome");
    expect(summary.flagged).toBe(1);
  });

  it("does not count a flag the reducer declined", async () => {
    const { service } = build({
      flag: false,
      unknown: [{ id: "u1", payment: { attentionRequiredAt: null }, providerOrderId: null, submittedAt: ago(31 * 60_000) }],
    });

    expect((await service.sweep()).flagged).toBe(0);
  });

  it("reports 3DS challenges older than 40 minutes", async () => {
    const { attemptFindMany, service } = build({ challenges: [{ id: "c1" }] });

    const summary = await service.sweep();

    const query = attemptFindMany.mock.calls.find(([args]) => args.where.status === PaymentAttemptStatus.ACTION_REQUIRED)?.[0];
    expect(query?.where.challengeCreatedAt?.lt).toEqual(ago(40 * 60_000));
    expect(summary.challengesOverdue).toBe(1);
    expect(alerts()).toEqual([{ count: 1, event: "payment_challenge_overdue", ids: ["c1"] }]);
  });

  it("flags reviews at one hour and alerts only those past 24 hours", async () => {
    const { reducer, service } = build({
      reviews: [
        { id: "r1", payment: { attentionRequiredAt: null, reviewStartedAt: ago(2 * 3_600_000) } },
        { id: "r2", payment: { attentionRequiredAt: null, reviewStartedAt: ago(25 * 3_600_000) } },
        { id: "r3", payment: { attentionRequiredAt: ago(1000), reviewStartedAt: ago(26 * 3_600_000) } },
      ],
    });

    const summary = await service.sweep();

    expect(reducer.flagAttention).toHaveBeenCalledTimes(2);
    expect(reducer.flagAttention).toHaveBeenCalledWith("r1", "review_over_1h");
    expect(reducer.flagAttention).toHaveBeenCalledWith("r2", "review_over_1h");
    expect(summary.flagged).toBe(2);
    expect(summary.reviewsOverAlert).toBe(2);
    expect(alerts()).toEqual([{ count: 2, event: "payment_review_over_24h", ids: ["r2", "r3"] }]);
  });

  it("reports overdue expiry using the grace period", async () => {
    const { prisma, service } = build({ overdue: [{ orderId: "o1" }, { orderId: "o2" }] });

    const summary = await service.sweep();

    const where = prisma.orderPayment.findMany.mock.calls[0]?.[0].where;
    expect(where.retryUntil).toEqual({ lt: ago(PAYMENT_EXPIRY_OVERDUE_MS) });
    expect(summary.expiryOverdue).toBe(2);
    expect(alerts()).toEqual([{ count: 2, event: "payment_expiry_overdue", ids: ["o1", "o2"] }]);
  });

  it("reports recently quarantined notifications by id only", async () => {
    const { prisma, service } = build({
      quarantined: [{ id: "n1", quarantineReason: "signature mismatch for secret-xyz" }],
    });

    const summary = await service.sweep();

    const where = prisma.paymentNotification.findMany.mock.calls[0]?.[0].where;
    expect(where.processedAt).toEqual({ gte: ago(PAYMENT_SWEEP_QUARANTINE_WINDOW_MS) });
    expect(summary.quarantinedRecent).toBe(1);
    expect(alerts()).toEqual([{ count: 1, event: "payment_notification_quarantined", ids: ["n1"] }]);
  });

  it("emits alert payloads with only event, count and ids (no secrets) and caps the id sample", async () => {
    const many = Array.from({ length: 15 }, (_, index) => ({ id: `c${index}`, providerOrderId: "ORD-SECRET", quarantineReason: "token=abc" }));
    const { service } = build({ challenges: many, quarantined: many });

    await service.sweep();

    for (const payload of alerts()) {
      expect(Object.keys(payload).sort()).toEqual(["count", "event", "ids"]);
      expect(payload.ids).toHaveLength(10);
      expect(payload.count).toBe(15);
    }
    const serialized = warn.mock.calls.map(([message]) => String(message)).join("\n");
    expect(serialized).not.toContain("ORD-SECRET");
    expect(serialized).not.toContain("token=abc");
  });
});
