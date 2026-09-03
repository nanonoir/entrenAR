import { toCheckoutApiError } from "@/lib/api/checkout/client";
import {
  getCheckoutRepository,
  reconcileCheckoutCartItems,
  type CheckoutCompleteInput,
  type CheckoutCompletion,
  type CheckoutLineItemInput,
  type CheckoutOperationError,
  type CheckoutQuote,
  type CheckoutQuoteInput,
} from "@/lib/api/checkout/checkout.repository";
import {
  CHECKOUT_ASYNC_STATUS,
  type CheckoutCompletionOptions,
  type CheckoutQuoteOptions,
  type CheckoutState,
} from "@/stores/cart-checkout.types";
import type { CartState } from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";

type CartCheckoutActions = Pick<
  CartState,
  | "clearCheckoutError"
  | "clearCheckoutState"
  | "completeCheckout"
  | "reconcileGuestCart"
  | "requestQuote"
  | "retryCompletion"
  | "retryQuote"
  | "syncBeforeLogout"
>;

export type CartStoreSetter = (
  partial: Partial<CartState> | ((state: CartState) => Partial<CartState>),
) => void;

export type CartStoreGetter = () => CartState;

let quoteRequestSequence = 0;
let completionRequestSequence = 0;
let idempotencySequence = 0;
let lastQuoteInput: CheckoutQuoteInput | null = null;
let lastCompletionInput: CheckoutCompleteInput | null = null;
let lastCompletionFingerprint: string | null = null;

export function createCartCheckoutActions(
  set: CartStoreSetter,
  get: CartStoreGetter,
): CartCheckoutActions {
  return {
    clearCheckoutError: () =>
      set({
        completionConflict: null,
        completionError: null,
        completionRetryAvailable: false,
        quoteConflict: null,
        quoteError: null,
        quoteRetryAvailable: false,
      }),
    clearCheckoutState: () => {
      invalidateCheckoutRequests();
      set(createIdleCheckoutState(null));
    },
    completeCheckout: (options) => completeCartCheckout(options, set, get),
    reconcileGuestCart: (email) => reconcileAuthenticatedCart(email, set, get),
    requestQuote: (options = {}) => requestCartQuote(options, set, get),
    retryCompletion: () => retryCartCompletion(set, get),
    retryQuote: () => retryCartQuote(set, get),
    syncBeforeLogout: () => syncCartBeforeLogout(set, get),
  };
}

export function createIdleCheckoutState(sessionToken: string | null): CheckoutState {
  return {
    checkoutSessionToken: sessionToken,
    completion: null,
    completionConflict: null,
    completionError: null,
    completionRetryAvailable: false,
    completionStatus: CHECKOUT_ASYNC_STATUS.IDLE,
    idempotencyKey: null,
    quote: null,
    quoteConflict: null,
    quoteError: null,
    quoteRetryAvailable: false,
    quoteStatus: CHECKOUT_ASYNC_STATUS.IDLE,
  };
}

export function invalidateCheckoutRequests(): void {
  quoteRequestSequence += 1;
  invalidateCompletionRequest();
  lastQuoteInput = null;
}

async function requestCartQuote(
  options: CheckoutQuoteOptions,
  set: CartStoreSetter,
  get: CartStoreGetter,
): Promise<CheckoutQuote | null> {
  invalidateCompletionRequest();
  const input = buildQuoteInput(options, get());
  const requestSequence = ++quoteRequestSequence;
  lastQuoteInput = input;

  set({
    completion: null,
    completionConflict: null,
    completionError: null,
    completionRetryAvailable: false,
    completionStatus: CHECKOUT_ASYNC_STATUS.IDLE,
    idempotencyKey: null,
    quoteConflict: null,
    quoteError: null,
    quoteRetryAvailable: false,
    quoteStatus: CHECKOUT_ASYNC_STATUS.LOADING,
  });

  try {
    const quote = await getCheckoutRepository().quote(input);
    if (requestSequence !== quoteRequestSequence) return quote;

    const currentState = get();
    set({
      checkoutSessionToken: quote.sessionToken?.trim() || (input.sessionToken ? currentState.checkoutSessionToken : null),
      items: reconcileCartWithQuote(currentState.items, quote),
      quote,
      quoteConflict: null,
      quoteError: null,
      quoteRetryAvailable: false,
      quoteStatus: CHECKOUT_ASYNC_STATUS.SUCCESS,
    });
    return quote;
  } catch (error) {
    if (requestSequence !== quoteRequestSequence) return null;

    const operationError = toCartCheckoutError(error, "CHECKOUT_QUOTE_FAILED", "The checkout quote could not be loaded.");
    set({
      quoteConflict: isCheckoutConflict(operationError) ? operationError : null,
      quoteError: operationError,
      quoteRetryAvailable: isRetryableCheckoutError(operationError),
      quoteStatus: CHECKOUT_ASYNC_STATUS.ERROR,
    });
    return null;
  }
}

async function completeCartCheckout(
  options: CheckoutCompletionOptions,
  set: CartStoreSetter,
  get: CartStoreGetter,
): Promise<CheckoutCompletion | null> {
  const state = get();
  const provisionalInput = buildCompletionInput(options, state, "checkout-idempotency-placeholder");
  const fingerprint = stableSerialize(provisionalInput);
  const requestedKey = normalizeOptionalValue(options.idempotencyKey);
  const idempotencyKey = requestedKey
    ?? (state.idempotencyKey && lastCompletionFingerprint === fingerprint ? state.idempotencyKey : null)
    ?? createIdempotencyKey();
  const input = { ...provisionalInput, idempotencyKey };

  lastCompletionInput = input;
  lastCompletionFingerprint = fingerprint;
  return executeCartCompletion(input, set);
}

async function executeCartCompletion(
  input: CheckoutCompleteInput,
  set: CartStoreSetter,
): Promise<CheckoutCompletion | null> {
  const requestSequence = ++completionRequestSequence;
  set({
    completionConflict: null,
    completionError: null,
    completionRetryAvailable: false,
    completionStatus: CHECKOUT_ASYNC_STATUS.LOADING,
    idempotencyKey: input.idempotencyKey,
  });

  try {
    const completion = await getCheckoutRepository().complete(input);
    if (requestSequence !== completionRequestSequence) return completion;

    set({
      checkoutSessionToken: null,
      completion,
      completionConflict: null,
      completionError: null,
      completionRetryAvailable: false,
      completionStatus: CHECKOUT_ASYNC_STATUS.SUCCESS,
      items: [],
    });
    return completion;
  } catch (error) {
    if (requestSequence !== completionRequestSequence) return null;

    const operationError = toCartCheckoutError(error, "CHECKOUT_COMPLETION_FAILED", "The order could not be completed.");
    set({
      completionConflict: isCheckoutConflict(operationError) ? operationError : null,
      completionError: operationError,
      completionRetryAvailable: isRetryableCheckoutError(operationError),
      completionStatus: CHECKOUT_ASYNC_STATUS.ERROR,
    });
    return null;
  }
}

function retryCartQuote(set: CartStoreSetter, get: CartStoreGetter): Promise<CheckoutQuote | null> {
  const state = get();
  if (!lastQuoteInput || !state.quoteRetryAvailable) return Promise.resolve(null);
  return requestCartQuote(lastQuoteInput, set, get);
}

function retryCartCompletion(set: CartStoreSetter, get: CartStoreGetter): Promise<CheckoutCompletion | null> {
  if (!lastCompletionInput || !get().completionRetryAvailable) return Promise.resolve(null);
  return executeCartCompletion(lastCompletionInput, set);
}

async function reconcileAuthenticatedCart(
  email: string | undefined,
  set: CartStoreSetter,
  get: CartStoreGetter,
): Promise<boolean> {
  const state = get();
  const normalizedEmail = normalizeOptionalValue(email)?.toLocaleLowerCase() ?? null;
  const accountChanged = Boolean(state.activeUserEmail && normalizedEmail && state.activeUserEmail !== normalizedEmail);
  const sessionToken = accountChanged ? null : state.checkoutSessionToken;
  invalidateCheckoutRequests();
  set({ activeUserEmail: normalizedEmail, ...createIdleCheckoutState(sessionToken) });
  if (state.items.length === 0) return true;

  const quote = await requestCartQuote({
    items: toCheckoutLineItems(state.items),
    sessionToken,
  }, set, get);
  return quote !== null;
}

async function syncCartBeforeLogout(set: CartStoreSetter, get: CartStoreGetter): Promise<boolean> {
  const state = get();
  if (state.items.length === 0) return true;

  const quote = await requestCartQuote({
    items: toCheckoutLineItems(state.items),
    sessionToken: state.checkoutSessionToken,
  }, set, get);
  return quote !== null;
}

function buildQuoteInput(options: CheckoutQuoteOptions, state: CartState): CheckoutQuoteInput {
  const { items: requestedItems, sessionToken: requestedSessionToken, ...selection } = options;
  const sessionToken = requestedSessionToken === null ? undefined : requestedSessionToken ?? state.checkoutSessionToken;
  return {
    ...selection,
    items: reconcileCheckoutCartItems(requestedItems ?? toCheckoutLineItems(state.items)),
    ...(sessionToken ? { sessionToken: sessionToken.trim() } : {}),
  };
}

function buildCompletionInput(
  options: CheckoutCompletionOptions,
  state: CartState,
  idempotencyKey: string,
): CheckoutCompleteInput {
  const { items: requestedItems, quoteId: requestedQuoteId, sessionToken: requestedSessionToken, ...checkoutInput } = options;
  const sessionToken = requestedSessionToken === null ? undefined : requestedSessionToken ?? state.checkoutSessionToken;
  const quoteId = requestedQuoteId === null ? undefined : requestedQuoteId ?? state.quote?.quoteId;
  return {
    ...checkoutInput,
    idempotencyKey,
    items: reconcileCheckoutCartItems(requestedItems ?? toCheckoutLineItems(state.items)),
    ...(quoteId ? { quoteId: quoteId.trim() } : {}),
    ...(sessionToken ? { sessionToken: sessionToken.trim() } : {}),
  };
}

function toCheckoutLineItems(items: readonly CartPreviewItem[]): CheckoutLineItemInput[] {
  return reconcileCheckoutCartItems(items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    ...(item.variantId.trim() ? { variantId: item.variantId } : {}),
  })));
}

function reconcileCartWithQuote(items: readonly CartPreviewItem[], quote: CheckoutQuote): CartPreviewItem[] {
  return quote.items.map((quoteItem) => {
    const current = items.find((item) =>
      item.productId === quoteItem.productId
      && (quoteItem.variantId === undefined || item.variantId === quoteItem.variantId),
    );
    const variantId = quoteItem.variantId ?? current?.variantId ?? "";
    const stock = Math.max(quoteItem.quantity, quoteItem.availableQuantity ?? quoteItem.quantity);

    return {
      brand: current?.brand ?? "",
      compareAtPrice: quoteItem.compareAtPrice,
      imageTone: current?.imageTone ?? "black",
      name: quoteItem.productName,
      price: quoteItem.unitPrice,
      productId: quoteItem.productId,
      quantity: quoteItem.quantity,
      slug: current?.slug ?? quoteItem.productId,
      stock,
      variantId,
      variantLabel: quoteItem.variantName ?? current?.variantLabel ?? quoteItem.sku,
    };
  });
}

function toCartCheckoutError(error: unknown, fallbackCode: string, fallbackMessage: string): CheckoutOperationError {
  const normalized = toCheckoutApiError(error, fallbackCode, fallbackMessage);
  return {
    code: normalized.code,
    message: normalized.message,
    ok: false,
    ...(normalized.issues.length > 0 ? { issues: normalized.issues } : {}),
    status: normalized.status,
  };
}

function isCheckoutConflict(error: CheckoutOperationError): boolean {
  return error.status === 409 || error.code === "CHECKOUT_SESSION_INVALID";
}

function isRetryableCheckoutError(error: CheckoutOperationError): boolean {
  return isCheckoutConflict(error)
    || error.code === "CHECKOUT_API_UNAVAILABLE"
    || error.status === 429
    || (error.status ?? 0) >= 500;
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function createIdempotencyKey(): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++idempotencySequence}`;
  return `checkout-${suffix}`;
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function invalidateCompletionRequest(): void {
  completionRequestSequence += 1;
  lastCompletionInput = null;
  lastCompletionFingerprint = null;
}
