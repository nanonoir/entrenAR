import { getAccountAccessToken } from "@/lib/api/account/client";
import { DATA_SOURCE } from "@/lib/api/config";
import {
  type CheckoutCompleteInput,
  type CheckoutCompletion,
  type CheckoutLineItemInput,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type CheckoutRepository,
} from "@/lib/api/checkout/checkout.repository";

import {
  CHECKOUT_CURRENCY,
  CHECKOUT_ORDER_STATUS,
  createId,
  createMockInventory,
  MOCK_ID_PREFIX,
  mockCoupon,
  mockPaymentMethods,
  mockPickupPoints,
  mockShippingOptions,
  reconcileCheckoutCartItems,
  resolveMockDelivery,
  resolveMockLines,
  roundMoney,
  sessionOwnerKey,
  type MockResolvedLine,
} from "./mock-checkout.rules";
import {
  assertCompleteInput,
  assertMockPaymentSelection,
  assertQuoteInput,
  cloneCompletion,
  cloneQuote,
  idempotencyKeyReused,
  invalidSession,
  outOfStock,
  priceChanged,
  quoteFingerprint,
  shippingUnavailable,
  stableSerialize,
  toCompletionFingerprint,
  toQuoteItem,
} from "./mock-checkout.validation";

type MockOwner = {
  key: string;
  sessionToken?: string;
  reconciledItems?: CheckoutLineItemInput[];
};

type StoredQuote = {
  ownerKey: string;
  quote: CheckoutQuote;
};

type StoredCompletion = {
  fingerprint: string;
  response: CheckoutCompletion;
};

export class MockCheckoutRepository implements CheckoutRepository {
  readonly source = DATA_SOURCE.MOCK;

  private readonly cartItemsByOwner = new Map<string, CheckoutLineItemInput[]>();
  private readonly claimedSessionTokens = new Set<string>();
  private readonly completedSessionTokens = new Set<string>();
  private readonly idempotencyByOwnerAndKey = new Map<string, StoredCompletion>();
  private readonly inventoryByKey: Map<string, number>;
  private readonly quotesById = new Map<string, StoredQuote>();

  constructor() {
    this.inventoryByKey = createMockInventory();
  }

  async quote(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    assertQuoteInput(input);
    const owner = this.resolveOwner(input);
    const items = this.reconcileOwnerCart(owner, input.items);
    const lines = resolveMockLines(items, this.inventoryByKey);
    const subtotal = roundMoney(lines.reduce((total, line) => total + line.lineSubtotal, 0));
    const paymentMethods = mockPaymentMethods();
    const shippingOptions = mockShippingOptions();
    const pickupPoints = mockPickupPoints(input);
    const shipping = resolveMockDelivery(input, shippingOptions, pickupPoints);
    const coupon = mockCoupon(input.couponCode, subtotal);
    const discount = coupon?.discountAmount ?? 0;
    const total = roundMoney(Math.max(0, subtotal - discount + shipping));
    const quote: CheckoutQuote = {
      currency: CHECKOUT_CURRENCY,
      discount,
      items: lines.map(toQuoteItem),
      paymentMethods,
      pickupPoints,
      quoteId: createId(MOCK_ID_PREFIX.QUOTE),
      shipping,
      shippingOptions,
      subtotal,
      total,
      warnings: [],
      ok: true,
      ...(coupon ? { coupon } : {}),
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      ...(owner.sessionToken ? { sessionToken: owner.sessionToken } : {}),
    };

    this.quotesById.set(quote.quoteId, { ownerKey: owner.key, quote });
    return cloneQuote(quote);
  }

  async complete(input: CheckoutCompleteInput): Promise<CheckoutCompletion> {
    assertQuoteInput(input);
    assertCompleteInput(input);
    if (!getAccountAccessToken() && !input.sessionToken) throw invalidSession();
    const owner = this.resolveOwner(input, true);
    const idempotencyMapKey = `${owner.key}:${input.idempotencyKey.trim()}`;
    const fingerprint = stableSerialize(toCompletionFingerprint(input));
    const stored = this.idempotencyByOwnerAndKey.get(idempotencyMapKey);

    if (stored) {
      if (stored.fingerprint !== fingerprint) throw idempotencyKeyReused();
      return cloneCompletion(stored.response);
    }

    const quoteInput: CheckoutQuoteInput = {
      ...(input.address ? { address: input.address } : {}),
      ...(input.addressId ? { addressId: input.addressId } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      ...(input.deliveryType ? { deliveryType: input.deliveryType } : {}),
      items: input.items,
      ...(input.pickupPointId ? { pickupPointId: input.pickupPointId } : {}),
      ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      ...(input.province ? { province: input.province } : {}),
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      ...(input.shippingMethodId ? { shippingMethodId: input.shippingMethodId } : {}),
      ...(input.shippingProviderId ? { shippingProviderId: input.shippingProviderId } : {}),
    };
    const currentQuote = await this.quote(quoteInput);
    this.assertQuoteContinuity(input.quoteId, owner.key, currentQuote);
    assertMockPaymentSelection(input, currentQuote);
    if (!input.pickupPointId && !input.shippingMethodId && !input.shippingProviderId) throw shippingUnavailable();

    const lines = resolveMockLines(currentQuote.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.variantId ? { variantId: item.variantId } : {}),
    })), this.inventoryByKey);
    this.deductInventory(lines);

    const response: CheckoutCompletion = {
      currency: CHECKOUT_CURRENCY,
      number: createId(MOCK_ID_PREFIX.ORDER_NUMBER),
      ok: true,
      order: {
        currency: CHECKOUT_CURRENCY,
        id: createId(MOCK_ID_PREFIX.ORDER),
        number: "",
        status: CHECKOUT_ORDER_STATUS.PENDING,
        total: currentQuote.total,
      },
      orderId: "",
      status: CHECKOUT_ORDER_STATUS.PENDING,
      total: currentQuote.total,
    };
    response.orderId = response.order?.id ?? "";
    response.number = response.order?.number ?? response.number;
    if (response.order) response.order.number = response.number;

    this.idempotencyByOwnerAndKey.set(idempotencyMapKey, {
      fingerprint,
      response,
    });
    this.cartItemsByOwner.delete(owner.key);
    if (owner.sessionToken) this.completedSessionTokens.add(owner.sessionToken);

    return cloneCompletion(response);
  }

  private resolveOwner(input: CheckoutQuoteInput, allowCompleted = false): MockOwner {
    const accessToken = getAccountAccessToken();
    if (accessToken) {
      if (input.sessionToken) {
        if (!allowCompleted && this.completedSessionTokens.has(input.sessionToken)) throw invalidSession();

        const guestKey = sessionOwnerKey(input.sessionToken);
        const guestItems = this.cartItemsByOwner.get(guestKey) ?? [];
        const accountItems = this.cartItemsByOwner.get("account") ?? [];
        if (!this.claimedSessionTokens.has(input.sessionToken) && guestItems.length === 0) throw invalidSession();
        const mergedItems = guestItems.length > 0
          ? reconcileCheckoutCartItems([...accountItems, ...guestItems])
          : accountItems.length > 0
            ? accountItems
            : reconcileCheckoutCartItems(input.items);
        if (guestItems.length > 0) {
          this.cartItemsByOwner.delete(guestKey);
          this.claimedSessionTokens.add(input.sessionToken);
        }
        this.cartItemsByOwner.set("account", mergedItems);
        return { key: "account", reconciledItems: mergedItems, sessionToken: input.sessionToken };
      }

      return { key: "account" };
    }

    const sessionToken = input.sessionToken ?? createId(MOCK_ID_PREFIX.SESSION);
    if (!allowCompleted && this.completedSessionTokens.has(sessionToken)) throw invalidSession();
    if (!allowCompleted && input.sessionToken && !this.cartItemsByOwner.has(sessionOwnerKey(sessionToken))) {
      throw invalidSession();
    }

    return { key: sessionOwnerKey(sessionToken), sessionToken };
  }

  private reconcileOwnerCart(owner: MockOwner, requestedItems: readonly CheckoutLineItemInput[]): CheckoutLineItemInput[] {
    const items = owner.reconciledItems ?? reconcileCheckoutCartItems(requestedItems);
    this.cartItemsByOwner.set(owner.key, items);
    return items;
  }

  private assertQuoteContinuity(quoteId: string | undefined, ownerKey: string, currentQuote: CheckoutQuote): void {
    if (!quoteId) return;
    const previous = this.quotesById.get(quoteId);
    if (!previous || previous.ownerKey !== ownerKey || quoteFingerprint(previous.quote) !== quoteFingerprint(currentQuote)) {
      throw priceChanged();
    }
  }

  private deductInventory(lines: readonly MockResolvedLine[]): void {
    for (const line of lines) {
      const available = this.inventoryByKey.get(line.inventoryKey) ?? 0;
      if (line.quantity > available) throw outOfStock();
      this.inventoryByKey.set(line.inventoryKey, available - line.quantity);
    }
  }
}
