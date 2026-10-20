"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildQuoteOptions,
  getAppliedCouponCode,
  toSettledQuoteOptions,
} from "@/components/checkout/checkout-form.builders";
import {
  hasSelection,
  isSelectionRejectionCode,
  selectionAllowed,
  selectionKey,
  withSelectionRemoved,
  type CheckoutDestination,
} from "@/components/checkout/checkout-destination";
import {
  type CheckoutLineItemInput,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import {
  type CheckoutQuoteOptions,
} from "@/stores/cart-checkout.types";
import { useCartStore } from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";

export interface CheckoutQuoteLifecycleInput {
  /** Committed destination: only fields that may change options or cost, plus the exact selection. */
  destination: CheckoutDestination;
  items: readonly CartPreviewItem[];
  quote: CheckoutQuote | null;
  requestQuote: (options?: CheckoutQuoteOptions) => Promise<CheckoutQuote | null>;
}

export interface CheckoutQuoteLifecycle {
  hydrated: boolean;
  reconciliationMessage: string | null;
  /** Re-quotes the committed destination (or an override) keeping the exact selection and the applied coupon. */
  refreshQuote: (destination?: CheckoutDestination) => Promise<CheckoutQuote | null>;
  /** Validates a coupon through the committed wizard destination; never infers a shipping service. */
  applyCoupon: (couponCode: string) => Promise<CheckoutQuote | null>;
}

export function useCheckoutQuoteLifecycle({
  destination,
  items,
  quote,
  requestQuote,
}: CheckoutQuoteLifecycleInput): CheckoutQuoteLifecycle {
  const [hydrated, setHydrated] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);
  const quoteRequestFingerprintRef = useRef<string | null>(null);
  // Location + selection the backend already refused: never re-sent until either changes (prevents retry loops).
  const rejectedSelectionKeyRef = useRef<string | null>(null);
  const appliedCouponCode = getAppliedCouponCode(quote);

  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      quoteRequestFingerprintRef.current = null;
      rejectedSelectionKeyRef.current = null;
      return;
    }

    // The selection intent (restored or kept across a location change) travels with the first request so a valid
    // choice resolves in one quote; if the server refuses it, `runQuote` falls back once to the plain listing.
    const options = buildQuoteOptions(items, selectionAllowed(destination, rejectedSelectionKeyRef.current), appliedCouponCode);
    if (quoteRequestFingerprintRef.current === JSON.stringify(options)) return;

    void runQuote(options, destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runQuote only reads refs and the stable requestQuote.
  }, [appliedCouponCode, destination, hydrated, items, requestQuote]);

  async function runQuote(initial: CheckoutQuoteOptions, target: CheckoutDestination): Promise<CheckoutQuote | null> {
    let options = initial;
    let fingerprint = JSON.stringify(options);
    quoteRequestFingerprintRef.current = fingerprint;
    setReconciliationMessage(null);
    let nextQuote = await requestQuote(options);

    if (!nextQuote && quoteRequestFingerprintRef.current === fingerprint && hasSelection(options) && isSelectionRejection()) {
      // Deliberate fallback: the server's answer, not the stale id, decides; the unavailable selection is then surfaced.
      rejectedSelectionKeyRef.current = selectionKey(target);
      options = withSelectionRemoved(options);
      fingerprint = JSON.stringify(options);
      quoteRequestFingerprintRef.current = fingerprint;
      nextQuote = await requestQuote(options);
    }

    if (!nextQuote || quoteRequestFingerprintRef.current !== fingerprint) return null;

    quoteRequestFingerprintRef.current = JSON.stringify(toSettledQuoteOptions(options, nextQuote));
    setReconciliationMessage(getReconciliationMessage(options.items ?? [], nextQuote));
    return nextQuote;
  }

  function refreshQuote(destinationOverride?: CheckoutDestination): Promise<CheckoutQuote | null> {
    const target = destinationOverride ?? destination;
    return runQuote(buildQuoteOptions(items, target, appliedCouponCode), target);
  }

  function applyCoupon(couponCode: string): Promise<CheckoutQuote | null> {
    return runQuote(buildQuoteOptions(items, selectionAllowed(destination, rejectedSelectionKeyRef.current), couponCode), destination);
  }

  return { applyCoupon, hydrated, reconciliationMessage, refreshQuote };
}

function isSelectionRejection(): boolean {
  return isSelectionRejectionCode(useCartStore.getState().quoteError?.code);
}

function getReconciliationMessage(
  requestedItems: readonly CheckoutLineItemInput[],
  quote: CheckoutQuote,
): string | null {
  const requestedByKey = new Map(requestedItems.map((item) => [lineItemKey(item), item.quantity]));
  const quotedByKey = new Map(quote.items.map((item) => [lineItemKey(item), item.quantity]));
  const hasAddedItem = [...quotedByKey.keys()].some((key) => !requestedByKey.has(key));
  const hasRemovedItem = [...requestedByKey.keys()].some((key) => !quotedByKey.has(key));
  const hasQuantityChange = [...quotedByKey].some(([key, quantity]) => requestedByKey.get(key) !== quantity);
  if (!hasAddedItem && !hasQuantityChange && !hasRemovedItem) return null;
  if (hasAddedItem && hasQuantityChange) return "Sincronizamos tu carrito y ajustamos algunas cantidades con la disponibilidad actual.";
  if (hasAddedItem) return "Sincronizamos los productos guardados en tu carrito con esta sesión de checkout.";
  if (hasRemovedItem) return "Actualizamos tu carrito porque una selección ya no está disponible.";
  return "Ajustamos algunas cantidades con la disponibilidad actual.";
}

function lineItemKey(item: { productId: string; variantId?: string }): string {
  return `${item.productId.trim()}:${item.variantId?.trim() ?? ""}`;
}
