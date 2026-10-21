import { createHmac } from "node:crypto";

import {
  WEBHOOK_MAX_SKEW_MS,
  buildWebhookManifest,
  parseSignatureHeader,
  verifyMercadoPagoWebhookSignature,
} from "./mercadopago-webhook.signature";

const secret = "unit-webhook-secret";
const requestId = "2066ca19-c6f1-498a-be75-1923005edd06";
const nowMs = 1_742_505_700_000;

function sign(dataId: string, ts: string, key = secret, request = requestId): string {
  const v1 = createHmac("sha256", key).update(buildWebhookManifest(dataId, request, ts)).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

function verify(overrides: Partial<Parameters<typeof verifyMercadoPagoWebhookSignature>[0]> = {}) {
  const ts = String(nowMs);
  return verifyMercadoPagoWebhookSignature({
    dataId: "ORD01M28P44G5FG8RJPM579EH56FV",
    nowMs,
    requestId,
    secret,
    signatureHeader: sign("ORD01M28P44G5FG8RJPM579EH56FV", ts),
    ...overrides,
  });
}

describe("verifyMercadoPagoWebhookSignature", () => {
  it("lowercases data.id in the manifest only", () => {
    expect(buildWebhookManifest("ORD01ABC", "req", "1742505638683")).toBe("id:ord01abc;request-id:req;ts:1742505638683;");
    expect(verify()).toEqual({ ok: true, timestampMs: nowMs });
  });

  it("accepts 10-digit seconds and signs the original timestamp text", () => {
    const ts = String(Math.floor(nowMs / 1_000));
    expect(verify({ signatureHeader: sign("ORD01M28P44G5FG8RJPM579EH56FV", ts) })).toEqual({ ok: true, timestampMs: Number(ts) * 1_000 });
  });

  it("rejects stale and future timestamps beyond five minutes", () => {
    const stale = String(nowMs - WEBHOOK_MAX_SKEW_MS - 1_000);
    const future = String(nowMs + WEBHOOK_MAX_SKEW_MS + 1_000);
    expect(verify({ signatureHeader: sign("ORD01M28P44G5FG8RJPM579EH56FV", stale) })).toEqual({ ok: false, reason: "stale" });
    expect(verify({ signatureHeader: sign("ORD01M28P44G5FG8RJPM579EH56FV", future) })).toEqual({ ok: false, reason: "stale" });
    expect(verify({ signatureHeader: sign("ORD01M28P44G5FG8RJPM579EH56FV", String(nowMs - 60_000)) }).ok).toBe(true);
  });

  it("rejects a wrong secret, tampered data.id and tampered request id", () => {
    const header = sign("ORD01M28P44G5FG8RJPM579EH56FV", String(nowMs), "other-secret");
    expect(verify({ signatureHeader: header })).toEqual({ ok: false, reason: "invalid_signature" });
    expect(verify({ dataId: "ORD01OTHER" })).toEqual({ ok: false, reason: "invalid_signature" });
    expect(verify({ requestId: "another-request" })).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it.each([
    ["missing header", undefined],
    ["empty header", ""],
    ["no v1", "ts=1742505638683"],
    ["no ts", `v1=${"a".repeat(64)}`],
    ["short hash", "ts=1742505638683,v1=abcd"],
    ["non hex hash", `ts=1742505638683,v1=${"z".repeat(64)}`],
    ["bad ts length", `ts=17425056,v1=${"a".repeat(64)}`],
    ["duplicate ts", `ts=1742505638683,ts=1742505638684,v1=${"a".repeat(64)}`],
    ["array header", [`ts=1742505638683,v1=${"a".repeat(64)}`]],
    ["oversized header", `ts=1742505638683,v1=${"a".repeat(64)},x=${"b".repeat(300)}`],
  ])("treats %s as malformed", (_name, header) => {
    expect(verify({ signatureHeader: header })).toEqual({ ok: false, reason: "malformed" });
  });

  it.each([
    ["missing data.id", { dataId: undefined }],
    ["array data.id", { dataId: ["a", "b"] }],
    ["object data.id", { dataId: { a: "b" } }],
    ["missing request id", { requestId: undefined }],
    ["request id with delimiter", { requestId: "a;b" }],
  ])("treats %s as malformed", (_name, overrides) => {
    expect(verify(overrides)).toEqual({ ok: false, reason: "malformed" });
  });

  it("compares signatures with a constant-time primitive", () => {
    const source = jest.requireActual<typeof import("node:fs")>("node:fs").readFileSync(
      require.resolve("./mercadopago-webhook.signature"),
      "utf8",
    );
    expect(source).toContain("timingSafeEqual");
  });
});

describe("parseSignatureHeader", () => {
  it("tolerates whitespace and extra keys", () => {
    const parsed = parseSignatureHeader(`ts=1742505638683, v1=${"a".repeat(64)}, v0=ignored`);
    expect(parsed).toEqual({ signature: "a".repeat(64), timestamp: "1742505638683" });
  });
});
