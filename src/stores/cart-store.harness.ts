import type {
  CheckoutCompleteInput,
  CheckoutLineItemInput,
  CheckoutOperationError,
  CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import type {
  CheckoutCompletionOptions,
  CheckoutQuoteOptions,
} from "@/stores/cart-checkout.types";
import type { CartPreviewItem } from "@/types/cart";

async function run(): Promise<void> {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
  process.env.NEXT_PUBLIC_CHECKOUT_DATA_SOURCE = "mock";

  const { CHECKOUT_ASYNC_STATUS, useCartStore } = await import("./cart-store");
  const { clearAccountAccessToken, setAccountAccessToken } = await import("@/lib/api/account/client");
  const { DATA_SOURCE, getCheckoutRepository } = await import("@/lib/api/checkout/checkout.repository");
  const { getPreviewCartItems } = await import("@/lib/data/cart-preview");

  const store = useCartStore;
  const repository = getCheckoutRepository();
  const [wheyPreviewItem, creatinePreviewItem] = getPreviewCartItems();

  assert(repository.source === DATA_SOURCE.MOCK, "Cart store harness must use the mock checkout repository.");
  assert(wheyPreviewItem !== undefined, "The preview cart must contain a whey checkout fixture.");
  assert(creatinePreviewItem !== undefined, "The preview cart must contain a creatine checkout fixture.");

  clearAccountAccessToken();
  store.getState().clearCart();

  const quote = await runQuoteAndCompletionScenario(wheyPreviewItem, repository);
  await runConflictAndRetryScenario(creatinePreviewItem);
  await runReconciliationScenario(wheyPreviewItem, creatinePreviewItem, quote);

  clearAccountAccessToken();
  store.getState().clearCart();
  console.log("cart store harness: authoritative quote, completion cleanup, idempotent replay, guest/account reconciliation, and conflict/retry state passed");

  async function runQuoteAndCompletionScenario(
    previewItem: CartPreviewItem,
    checkoutRepository: typeof repository,
  ): Promise<CheckoutQuote> {
    const staleClientItem = {
      ...previewItem,
      price: 1,
      stock: 0,
      total: 1,
      userId: "foreign-user",
    } as unknown as CheckoutLineItemInput;
    const quoteOptions: CheckoutQuoteOptions = {
      address: addressInput(),
      deliveryType: "shipping",
      items: [staleClientItem, { ...staleClientItem, quantity: 1 }],
      shippingMethodId: "andreani:envío-a-domicilio",
    };
    const quote = await store.getState().requestQuote(quoteOptions);

    assert(quote !== null, "The cart store did not return an authoritative quote.");
    const quoteItem = quote.items[0];
    assert(quoteItem !== undefined, "The authoritative quote did not contain its reconciled line.");
    assert(quote.sessionToken !== undefined, "The guest quote did not expose a checkout session token.");
    assert(quoteItem.quantity === 2, "The cart store did not reconcile duplicate checkout lines.");
    assert(quoteItem.unitPrice === 78900, "The cart store did not retain the mock adapter's authoritative price.");
    assert(quote.subtotal === 157800, "The cart store did not retain the authoritative quote subtotal.");
    assert(quote.shipping === 4200, "The cart store did not retain the authoritative shipping cost.");

    const quotedState = store.getState();
    assert(quotedState.quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "The quote state did not settle successfully.");
    assert(quotedState.quote?.quoteId === quote.quoteId, "The cart store did not retain the successful quote.");
    assert(quotedState.checkoutSessionToken === quote.sessionToken, "The cart store did not retain the quote session.");
    assert(quotedState.items[0]?.price === quoteItem.unitPrice, "The cart store did not reconcile local price from the quote.");
    assert(quotedState.items[0]?.quantity === quoteItem.quantity, "The cart store did not reconcile local quantity from the quote.");

    const sessionToken = quote.sessionToken;
    const completionOptions: CheckoutCompletionOptions = {
      address: addressInput(),
      customer: customerInput(),
      deliveryType: "shipping",
      idempotencyKey: "cart-store-complete-key",
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      shippingMethodId: "andreani:envío-a-domicilio",
    };
    const completed = await store.getState().completeCheckout(completionOptions);

    assert(completed !== null, "The cart store did not complete an eligible quote.");
    assert(completed.orderId.length > 0, "The cart store completion did not return an order ID.");
    assert(completed.total === quote.total, "The cart store completion changed the quoted total.");

    const completedState = store.getState();
    assert(completedState.completionStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "The completion state did not settle successfully.");
    assert(completedState.items.length === 0, "Successful completion did not clear the cart items.");
    assert(completedState.checkoutSessionToken === null, "Successful completion did not clear the checkout session.");
    assert(completedState.completion?.orderId === completed.orderId, "The cart store did not retain the completion result.");

    const replay = await store.getState().completeCheckout({
      ...completionOptions,
      items: [checkoutLine(previewItem, quoteItem.quantity)],
      quoteId: quote.quoteId,
      sessionToken,
    });

    assert(replay !== null, "The cart store did not return the idempotent completion replay.");
    assert(replay.orderId === completed.orderId, "Idempotent replay returned a different order ID.");
    assert(replay.number === completed.number, "Idempotent replay returned a different order number.");
    assert(store.getState().completionStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "Idempotent replay did not remain successful.");

    const cleanupError = await captureError(() => checkoutRepository.quote({
      items: [checkoutLine(previewItem, quoteItem.quantity)],
      sessionToken,
    }));
    assert(isCheckoutOperationError(cleanupError), "Completed checkout cleanup did not return a controlled session error.");
    assert(cleanupError.code === "CHECKOUT_SESSION_INVALID", "Completed checkout cleanup returned the wrong error code.");
    assert(cleanupError.status === 401, "Completed checkout cleanup returned the wrong error status.");

    return quote;
  }

  async function runConflictAndRetryScenario(previewItem: CartPreviewItem): Promise<void> {
    store.getState().clearCart();

    const failedQuote = await store.getState().requestQuote({
      deliveryType: "shipping",
      items: [checkoutLine(previewItem, 1)],
      shippingMethodId: "unavailable-shipping-option",
    });

    assert(failedQuote === null, "An unavailable shipping option unexpectedly produced a quote.");
    assertQuoteConflictState("quote");

    const quoteRetry = await store.getState().retryQuote();
    assert(quoteRetry === null, "Retrying the unchanged quote conflict unexpectedly succeeded.");
    assertQuoteConflictState("quote retry");

    const recoveredQuote = await store.getState().requestQuote({
      deliveryType: "shipping",
      items: [checkoutLine(previewItem, 1)],
      shippingMethodId: "andreani:envío-a-domicilio",
    });

    assert(recoveredQuote !== null, "The cart store could not recover from the quote conflict.");
    assert(store.getState().quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "The recovered quote did not settle successfully.");

    const failedCompletion = await store.getState().completeCheckout({
      ...completionOptionsForConflict(),
      idempotencyKey: "cart-store-stale-key",
      quoteId: "missing-cart-store-quote",
    });

    assert(failedCompletion === null, "A stale quote unexpectedly completed.");
    assertCompletionConflictState("completion");

    const completionRetry = await store.getState().retryCompletion();
    assert(completionRetry === null, "Retrying the unchanged completion conflict unexpectedly succeeded.");
    assertCompletionConflictState("completion retry");

    const recoveredCompletion = await store.getState().completeCheckout({
      ...completionOptionsForConflict(),
      idempotencyKey: "cart-store-recovery-key",
      quoteId: recoveredQuote.quoteId,
    });

    assert(recoveredCompletion !== null, "The cart store could not recover from the completion conflict.");
    assert(store.getState().completionStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "The recovered completion did not settle successfully.");
    assert(store.getState().completionConflict === null, "The recovered completion retained stale conflict state.");
    assert(store.getState().items.length === 0, "The recovered completion did not clear the cart.");
  }

  async function runReconciliationScenario(
    accountCartItem: CartPreviewItem,
    guestCartItem: CartPreviewItem,
    previousQuote: CheckoutQuote,
  ): Promise<void> {
    store.getState().clearCart();
    clearAccountAccessToken();

    const guestQuote = await store.getState().requestQuote({
      items: [checkoutLine(guestCartItem, 1)],
    });

    assert(guestQuote !== null, "The guest quote for reconciliation did not succeed.");
    assert(guestQuote.sessionToken !== undefined, "The guest reconciliation fixture has no session token.");
    assert(previousQuote.quoteId !== guestQuote.quoteId, "The harness did not create an independent reconciliation quote.");

    setAccountAccessToken("cart-store-harness-auth-token");
    const accountQuote = await repository.quote({ items: [checkoutLine(accountCartItem, 1)] });
    assert(accountQuote.items[0]?.productId === accountCartItem.productId, "The account reconciliation fixture was not seeded.");

    const reconciled = await store.getState().reconcileGuestCart(" Customer@Example.TEST ");
    assert(reconciled, "The cart store did not report successful guest/account reconciliation.");

    const state = store.getState();
    assert(state.activeUserEmail === "customer@example.test", "The cart store did not normalize the authenticated account email.");
    assert(state.quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS, "The reconciled cart did not settle through the quote path.");
    assert(state.quote?.items.length === 2, "The cart store did not merge guest and account checkout items.");
    assert(state.quote?.items.some((item) => item.productId === accountCartItem.productId && item.quantity === 1), "The account cart item was lost during reconciliation.");
    assert(state.quote?.items.some((item) => item.productId === guestCartItem.productId && item.quantity === 1), "The guest cart item was lost during reconciliation.");
    assert(state.checkoutSessionToken === guestQuote.sessionToken, "Reconciliation did not retain the guest handoff session token.");
  }

  function assertQuoteConflictState(label: string): void {
    const state = store.getState();
    assert(state.quoteStatus === CHECKOUT_ASYNC_STATUS.ERROR, `${label} did not enter quote error state.`);
    assert(state.quoteConflict?.code === "SHIPPING_OPTION_UNAVAILABLE", `${label} did not expose the quote conflict code.`);
    assert(state.quoteConflict?.status === 409, `${label} did not expose the quote conflict status.`);
    assert(state.quoteError?.code === "SHIPPING_OPTION_UNAVAILABLE", `${label} did not retain the quote error.`);
    assert(state.quoteRetryAvailable, `${label} did not expose quote retry availability.`);
  }

  function assertCompletionConflictState(label: string): void {
    const state = store.getState();
    assert(state.completionStatus === CHECKOUT_ASYNC_STATUS.ERROR, `${label} did not enter completion error state.`);
    assert(state.completionConflict?.code === "PRICE_CHANGED", `${label} did not expose the completion conflict code.`);
    assert(state.completionConflict?.status === 409, `${label} did not expose the completion conflict status.`);
    assert(state.completionError?.code === "PRICE_CHANGED", `${label} did not retain the completion error.`);
    assert(state.completionRetryAvailable, `${label} did not expose completion retry availability.`);
  }

  function completionOptionsForConflict(): CheckoutCompletionOptions {
    return {
      address: addressInput(),
      customer: customerInput(),
      deliveryType: "shipping",
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      shippingMethodId: "andreani:envío-a-domicilio",
    };
  }
}

function checkoutLine(item: CartPreviewItem, quantity: number): CheckoutLineItemInput {
  return {
    productId: item.productId,
    quantity,
    ...(item.variantId.trim() ? { variantId: item.variantId } : {}),
  };
}

function addressInput(): NonNullable<CheckoutCompleteInput["address"]> {
  return {
    city: "Buenos Aires",
    number: "123",
    postalCode: "C1000",
    province: "Buenos Aires",
    street: "Test Street",
  };
}

function customerInput(): CheckoutCompleteInput["customer"] {
  return {
    email: "cart-store@example.test",
    firstName: "Cart",
    lastName: "Store",
  };
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the checkout adapter operation to fail.");
}

function isCheckoutOperationError(error: unknown): error is CheckoutOperationError {
  return isRecord(error)
    && error.ok === false
    && typeof error.code === "string"
    && typeof error.message === "string";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
