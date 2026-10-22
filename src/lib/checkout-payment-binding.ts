import type { CartGeneration } from "@/lib/cart-generation";

/**
 * Tab-scoped locator of the card order bound to this checkout. It lives outside the checkout draft and holds
 * only the order id, the guest checkout session credential, the submitted cart generation and a finalized flag.
 * Card data and card tokens are never stored here.
 */
export const PAYMENT_BINDING_STORAGE_KEY = "entrenar-checkout-payment:v1";
export const PAYMENT_BINDING_TTL_MS = 24 * 60 * 60 * 1000;

export interface PaymentBinding {
  createdAt: number;
  /** Set once cleanup of the submitted generation has run, so it never runs twice. */
  finalized: boolean;
  generation: CartGeneration;
  /** `null` until the backend confirms the order (a submission whose response was lost). */
  orderId: string | null;
  sessionToken: string | null;
}

type BindingStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function getStorage(): BindingStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPaymentBinding(now = Date.now(), storage: BindingStorage | null = getStorage()): PaymentBinding | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(PAYMENT_BINDING_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    const binding = sanitizeBinding(parsed);
    if (!binding || now - binding.createdAt > PAYMENT_BINDING_TTL_MS) {
      storage.removeItem(PAYMENT_BINDING_STORAGE_KEY);
      return null;
    }
    return binding;
  } catch {
    return null;
  }
}

export function writePaymentBinding(binding: PaymentBinding, storage: BindingStorage | null = getStorage()): void {
  if (!storage) return;

  try {
    storage.setItem(PAYMENT_BINDING_STORAGE_KEY, JSON.stringify(binding));
  } catch {
    // Storage failures degrade to the in-memory binding.
  }
}

export function clearPaymentBinding(storage: BindingStorage | null = getStorage()): void {
  try {
    storage?.removeItem(PAYMENT_BINDING_STORAGE_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/**
 * Guest credential for reading `orderId`. The tab binding is authoritative once it points at that order, even
 * after cart cleanup cleared the cart session; the cart session is only a fallback when no binding matches.
 */
export function resolveOrderSessionToken(
  orderId: string,
  binding: PaymentBinding | null,
  cartSessionToken: string | null,
): string | null {
  if (binding && (binding.orderId === null || binding.orderId === orderId)) return binding.sessionToken;
  return cartSessionToken;
}

/** Allowlist parse: unknown keys (for example anything card related) are dropped. */
export function sanitizeBinding(raw: unknown): PaymentBinding | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  if (typeof record.createdAt !== "number" || typeof record.finalized !== "boolean") return null;
  if (record.orderId !== null && typeof record.orderId !== "string") return null;
  if (record.sessionToken !== null && typeof record.sessionToken !== "string") return null;
  if (!Array.isArray(record.generation)) return null;

  const generation: CartGeneration[number][] = [];
  for (const line of record.generation) {
    if (!line || typeof line !== "object") return null;
    const { productId, quantity, variantId } = line as Record<string, unknown>;
    if (typeof productId !== "string" || typeof variantId !== "string" || typeof quantity !== "number") return null;
    generation.push({ productId, quantity, variantId });
  }

  return {
    createdAt: record.createdAt,
    finalized: record.finalized,
    generation,
    orderId: record.orderId,
    sessionToken: record.sessionToken,
  };
}
