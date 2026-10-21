import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../common/prisma/prisma.service";
import type { Prisma } from "../../generated/prisma/client";

export const WEBHOOK_TOPIC = {
  CHARGEBACK: "topic_chargebacks_wh",
  FRAUD_ALERT: "stop_delivery_op_wh",
  ORDER: "order",
} as const;

export type WebhookTopic = (typeof WEBHOOK_TOPIC)[keyof typeof WEBHOOK_TOPIC];

const TOPICS: ReadonlySet<string> = new Set(Object.values(WEBHOOK_TOPIC));
const EVENT_ID_MAX = 64;
const METADATA_VALUE_MAX = 64;

export const isWebhookTopic = (value: unknown): value is WebhookTopic => typeof value === "string" && TOPICS.has(value);

export interface AcceptNotificationInput {
  /** Unsigned body, used only for bounded metadata and dedup; never for state. */
  body: unknown;
  environment: string;
  /** `data.id` exactly as received (provider casing preserved for the API lookup). */
  resourceId: string;
  requestId: string;
  timestampMs: number;
  topic: WebhookTopic;
}

export interface AcceptedNotification {
  duplicate: boolean;
  id: string;
}

/** Stable receipt key: the same order emits many states, so the resource id alone is never the key. */
export function notificationDedupKey(input: Pick<AcceptNotificationInput, "environment" | "requestId" | "resourceId" | "timestampMs" | "topic"> & { eventId?: string }): string {
  const event = input.eventId ?? `${input.requestId}|${input.timestampMs}`;
  return createHash("sha256")
    .update(`mercadopago|${input.environment}|${input.topic}|${input.resourceId}|${event}`)
    .digest("hex");
}

function boundedScalar(value: unknown, max: number): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, max);
  if (typeof value === "string" && value.length > 0) return value.slice(0, max);
  return undefined;
}

export function extractBodyMetadata(body: unknown): { eventId?: string; metadata: Prisma.InputJsonObject } {
  const record = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const data = typeof record["data"] === "object" && record["data"] !== null ? (record["data"] as Record<string, unknown>) : {};
  const metadata: Record<string, string | boolean> = {};

  for (const [key, value] of [
    ["action", record["action"]],
    ["apiVersion", record["api_version"]],
    ["version", data["version"]],
  ] as const) {
    const scalar = boundedScalar(value, METADATA_VALUE_MAX);
    if (scalar !== undefined) metadata[key] = scalar;
  }
  if (typeof record["live_mode"] === "boolean") metadata["liveMode"] = record["live_mode"];

  const eventId = boundedScalar(record["id"], EVENT_ID_MAX);
  return { ...(eventId ? { eventId } : {}), metadata };
}

/** Durable acceptance of authenticated notifications. Only called after the signature has been verified. */
@Injectable()
export class PaymentNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async accept(input: AcceptNotificationInput): Promise<AcceptedNotification> {
    const { eventId, metadata } = extractBodyMetadata(input.body);
    const dedupKey = notificationDedupKey({ ...input, ...(eventId ? { eventId } : {}) });

    const created = await this.prisma.paymentNotification.createMany({
      data: [{
        dedupKey,
        ...(eventId ? { eventId } : {}),
        metadata,
        providerTimestamp: new Date(input.timestampMs),
        requestId: input.requestId,
        resourceId: input.resourceId,
        topic: input.topic,
      }],
      skipDuplicates: true,
    });
    const row = await this.prisma.paymentNotification.findUniqueOrThrow({ select: { id: true }, where: { dedupKey } });

    return { duplicate: created.count === 0, id: row.id };
  }
}
