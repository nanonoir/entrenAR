import type { PrismaService } from "../../common/prisma/prisma.service";
import {
  PaymentNotificationService,
  extractBodyMetadata,
  isWebhookTopic,
  notificationDedupKey,
} from "./payment-notification.service";

const base = { environment: "test", requestId: "req-1", resourceId: "ORD1", timestampMs: 1_000, topic: "order" } as const;

describe("notificationDedupKey", () => {
  it("is stable per event and differs per event id, topic, environment and resource", () => {
    const key = notificationDedupKey({ ...base, eventId: "e1" });
    expect(notificationDedupKey({ ...base, eventId: "e1" })).toBe(key);
    expect(notificationDedupKey({ ...base, eventId: "e2" })).not.toBe(key);
    expect(notificationDedupKey({ ...base, eventId: "e1", topic: "stop_delivery_op_wh" })).not.toBe(key);
    expect(notificationDedupKey({ ...base, eventId: "e1", environment: "production" })).not.toBe(key);
    expect(notificationDedupKey({ ...base, eventId: "e1", resourceId: "ORD2" })).not.toBe(key);
  });

  it("falls back to request id and timestamp, so later states of the same order are new notifications", () => {
    const first = notificationDedupKey(base);
    expect(notificationDedupKey(base)).toBe(first);
    expect(notificationDedupKey({ ...base, timestampMs: 2_000 })).not.toBe(first);
    expect(notificationDedupKey({ ...base, requestId: "req-2" })).not.toBe(first);
  });
});

describe("extractBodyMetadata", () => {
  it("keeps only bounded scalar metadata", () => {
    const { eventId, metadata } = extractBodyMetadata({
      action: "order.processed",
      data: { transactions: { huge: "x".repeat(10_000) }, version: 3 },
      id: 123,
      live_mode: true,
    });
    expect(eventId).toBe("123");
    expect(metadata).toEqual({ action: "order.processed", liveMode: true, version: "3" });
    expect(extractBodyMetadata("garbage")).toEqual({ metadata: {} });
  });
});

describe("isWebhookTopic", () => {
  it("only accepts handled topics", () => {
    expect(["order", "topic_chargebacks_wh", "stop_delivery_op_wh"].every(isWebhookTopic)).toBe(true);
    expect(isWebhookTopic("payment")).toBe(false);
    expect(isWebhookTopic(undefined)).toBe(false);
  });
});

describe("PaymentNotificationService.accept", () => {
  it("reports a duplicate when the dedup key already exists", async () => {
    const createMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "n1" });
    const prisma = { paymentNotification: { createMany, findUniqueOrThrow } } as unknown as PrismaService;
    const service = new PaymentNotificationService(prisma);
    const input = { ...base, body: { action: "order.processed" } };

    await expect(service.accept(input)).resolves.toEqual({ duplicate: false, id: "n1" });
    await expect(service.accept(input)).resolves.toEqual({ duplicate: true, id: "n1" });
    expect(createMany.mock.calls[0]![0].skipDuplicates).toBe(true);
    expect(createMany.mock.calls[0]![0].data[0].dedupKey).toBe(createMany.mock.calls[1]![0].data[0].dedupKey);
  });
});
