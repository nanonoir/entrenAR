import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_GATE_COOKIE = "entrenar_admin_gate";
export const ADMIN_GATE_VERSION = 1;
export const ADMIN_GATE_GRACE_SECONDS = 300;

type AdminGatePayload = {
  version: number;
  issuedAt: number;
  expiresAt: number;
};

export type AdminGateState = "active" | "expired" | "invalid";

function secret(): string {
  const value = process.env.ADMIN_GATE_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_GATE_SIGNING_SECRET is not configured.");
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createAdminGate(now = Date.now(), lifetimeSeconds = 1_800): string {
  const payload: AdminGatePayload = {
    version: ADMIN_GATE_VERSION,
    issuedAt: now,
    expiresAt: now + lifetimeSeconds * 1_000,
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function inspectAdminGate(value: string | undefined, now = Date.now()): AdminGateState {
  if (!value) return "invalid";
  const parts = value.split(".");
  const [encoded, signature] = parts;
  if (parts.length !== 2) return "invalid";
  if (!encoded || !signature) return "invalid";

  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return "invalid";

  try {
    const payload = JSON.parse(decode(encoded)) as Partial<AdminGatePayload>;
    const issuedAt = payload.issuedAt;
    const expiresAt = payload.expiresAt;
    if (
      payload.version !== ADMIN_GATE_VERSION
      || typeof issuedAt !== "number"
      || typeof expiresAt !== "number"
      || !Number.isFinite(issuedAt)
      || !Number.isFinite(expiresAt)
      || expiresAt <= issuedAt
      || now > expiresAt + ADMIN_GATE_GRACE_SECONDS * 1_000
    ) return "invalid";
    return now > expiresAt ? "expired" : "active";
  } catch {
    return "invalid";
  }
}

export function adminGateCookieOptions(request: Request, maxAge: number): {
  httpOnly: true;
  maxAge: number;
  path: "/admin";
  sameSite: "lax";
  secure: boolean;
} {
  const url = new URL(request.url);
  return {
    httpOnly: true,
    maxAge,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "preview" || url.protocol === "https:",
  };
}
