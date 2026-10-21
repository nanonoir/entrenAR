import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1_000;
export const WEBHOOK_SIGNATURE_HEADER_MAX = 256;
export const WEBHOOK_REQUEST_ID_MAX = 128;
export const WEBHOOK_DATA_ID_MAX = 128;

const DATA_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const TIMESTAMP_PATTERN = /^(?:\d{10}|\d{13})$/;
const SIGNATURE_PATTERN = /^[0-9a-fA-F]{64}$/;

export type WebhookSignatureFailure = "malformed" | "invalid_signature" | "stale";

export type WebhookSignatureResult =
  | { ok: true; timestampMs: number }
  | { ok: false; reason: WebhookSignatureFailure };

export interface WebhookSignatureInput {
  /** Scalar `data.id` query value exactly as received. */
  dataId: unknown;
  nowMs: number;
  requestId: unknown;
  secret: string;
  signatureHeader: unknown;
}

interface ParsedSignature {
  signature: string;
  /** Preserved as received: it is part of the HMAC manifest. */
  timestamp: string;
}

export function parseSignatureHeader(header: unknown): ParsedSignature | undefined {
  if (typeof header !== "string" || header.length === 0 || header.length > WEBHOOK_SIGNATURE_HEADER_MAX) return undefined;

  let timestamp: string | undefined;
  let signature: string | undefined;
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) return undefined;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "ts") {
      if (timestamp !== undefined) return undefined;
      timestamp = value;
    } else if (key === "v1") {
      if (signature !== undefined) return undefined;
      signature = value;
    }
  }

  if (timestamp === undefined || signature === undefined) return undefined;
  if (!TIMESTAMP_PATTERN.test(timestamp) || !SIGNATURE_PATTERN.test(signature)) return undefined;

  return { signature, timestamp };
}

/** Seconds (10 digits) or milliseconds (13 digits) normalized to ms, for freshness only. */
export function timestampToMilliseconds(timestamp: string): number {
  return timestamp.length === 10 ? Number(timestamp) * 1_000 : Number(timestamp);
}

export function buildWebhookManifest(dataId: string, requestId: string, timestamp: string): string {
  return `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
}

export function verifyMercadoPagoWebhookSignature(input: WebhookSignatureInput): WebhookSignatureResult {
  const parsed = parseSignatureHeader(input.signatureHeader);
  const { dataId, requestId } = input;
  if (
    !parsed
    || typeof dataId !== "string"
    || dataId.length === 0
    || dataId.length > WEBHOOK_DATA_ID_MAX
    || !DATA_ID_PATTERN.test(dataId)
    || typeof requestId !== "string"
    || requestId.length === 0
    || requestId.length > WEBHOOK_REQUEST_ID_MAX
    || !REQUEST_ID_PATTERN.test(requestId)
  ) {
    return { ok: false, reason: "malformed" };
  }

  const expected = createHmac("sha256", input.secret).update(buildWebhookManifest(dataId, requestId, parsed.timestamp)).digest();
  const received = Buffer.from(parsed.signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const timestampMs = timestampToMilliseconds(parsed.timestamp);
  if (Math.abs(input.nowMs - timestampMs) > WEBHOOK_MAX_SKEW_MS) return { ok: false, reason: "stale" };

  return { ok: true, timestampMs };
}
