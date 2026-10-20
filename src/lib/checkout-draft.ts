/**
 * Session-scoped checkout draft: field values and delivery intent only, never authority.
 * Allowlist-only (no tokens, quotes, totals, errors or payment secrets), 24h expiry from creation,
 * and every storage failure degrades silently to an in-memory checkout.
 */
export const CHECKOUT_DRAFT_STORAGE_KEY = "entrenar-checkout-draft:v1";
export const CHECKOUT_DRAFT_VERSION = 1;
export const CHECKOUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_VALUE_LENGTH = 200;

export const CHECKOUT_DRAFT_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "dni",
  "phone",
  "provinceId",
  "localityId",
  "city",
  "localityMode",
  "postalCode",
  "street",
  "streetNumber",
  "floor",
  "neighborhood",
  "recipient",
  "deliveryMethod",
  "shippingMethodId",
  "shippingProviderId",
  "pickupPointId",
  "paymentMethodId",
] as const;

export type CheckoutDraftField = (typeof CHECKOUT_DRAFT_FIELDS)[number];
export type CheckoutDraftValues = Record<CheckoutDraftField, string>;

type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type DraftEnvelope = { createdAt: number; expiresAt: number; values: CheckoutDraftValues; version: number };

let clearEpoch = 0;

export function createEmptyCheckoutDraftValues(): CheckoutDraftValues {
  return Object.fromEntries(CHECKOUT_DRAFT_FIELDS.map((field) => [field, ""])) as CheckoutDraftValues;
}

export function isEmptyCheckoutDraft(values: CheckoutDraftValues): boolean {
  return CHECKOUT_DRAFT_FIELDS.every((field) => values[field] === "");
}

/** Epoch captured by delayed writers; a clear invalidates every write scheduled before it. */
export function getCheckoutDraftEpoch(): number {
  return clearEpoch;
}

/** Keeps only allowlisted string fields within the length limit; returns null when the shape is unusable. */
export function sanitizeCheckoutDraftValues(raw: unknown): CheckoutDraftValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const values = createEmptyCheckoutDraftValues();
  for (const field of CHECKOUT_DRAFT_FIELDS) {
    const value = record[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return null;
    values[field] = value;
  }
  return values;
}

export function readCheckoutDraft(now = Date.now(), storage = getDraftStorage()): CheckoutDraftValues | null {
  const envelope = readEnvelope(now, storage);
  return envelope?.values ?? null;
}

/**
 * Persists the allowlisted values. Skips empty drafts (so hydration never overwrites a valid draft with blanks)
 * and writes scheduled before the latest clear (`epoch` mismatch). Returns whether anything was written.
 */
export function writeCheckoutDraft(
  values: CheckoutDraftValues,
  options: { epoch?: number; now?: number; storage?: DraftStorage | null } = {},
): boolean {
  const { epoch = clearEpoch, now = Date.now() } = options;
  const storage = options.storage === undefined ? getDraftStorage() : options.storage;
  if (!storage || epoch !== clearEpoch) return false;
  const sanitized = sanitizeCheckoutDraftValues(values);
  if (!sanitized || isEmptyCheckoutDraft(sanitized)) return false;

  const existing = readEnvelope(now, storage);
  const createdAt = existing?.createdAt ?? now;
  const envelope: DraftEnvelope = { createdAt, expiresAt: existing?.expiresAt ?? createdAt + CHECKOUT_DRAFT_TTL_MS, values: sanitized, version: CHECKOUT_DRAFT_VERSION };
  try {
    storage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Removes the draft and invalidates delayed writers; safe to call with no wizard mounted. */
export function clearCheckoutDraft(storage = getDraftStorage()): void {
  clearEpoch += 1;
  try {
    storage?.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing to clean.
  }
}

function readEnvelope(now: number, storage: DraftStorage | null): DraftEnvelope | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (serialized === null) return null;
    const parsed: unknown = JSON.parse(serialized);
    const envelope = parseEnvelope(parsed);
    if (!envelope || envelope.expiresAt <= now) {
      storage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      return null;
    }
    return envelope;
  } catch {
    try {
      storage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore: degraded to in-memory.
    }
    return null;
  }
}

function parseEnvelope(raw: unknown): DraftEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== CHECKOUT_DRAFT_VERSION) return null;
  if (typeof record.createdAt !== "number" || typeof record.expiresAt !== "number") return null;
  if (!Number.isFinite(record.createdAt) || !Number.isFinite(record.expiresAt)) return null;
  if (record.expiresAt - record.createdAt > CHECKOUT_DRAFT_TTL_MS) return null;
  const values = sanitizeCheckoutDraftValues(record.values);
  return values ? { createdAt: record.createdAt, expiresAt: record.expiresAt, values, version: CHECKOUT_DRAFT_VERSION } : null;
}

function getDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
