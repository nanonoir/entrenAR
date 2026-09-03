"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildQuoteOptions,
  toCheckoutLineItemsFromQuote,
} from "@/components/checkout/checkout-form.builders";
import type {
  DeliveryForm,
  DeliveryMethod,
} from "@/components/checkout/checkout-form.validators";
import {
  type CheckoutLineItemInput,
  type CheckoutQuote,
} from "@/lib/api/checkout/checkout.repository";
import {
  type CheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import {
  type CheckoutQuoteOptions,
} from "@/stores/cart-checkout.types";
import { useCartStore } from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";

export interface CheckoutQuoteLifecycleInput {
  deliveryForm: DeliveryForm;
  deliveryMethod: DeliveryMethod;
  detectedLocation: CheckoutPostalCodeLocation | undefined;
  items: readonly CartPreviewItem[];
  requestQuote: (options?: CheckoutQuoteOptions) => Promise<CheckoutQuote | null>;
  selectedPickupPoint: CheckoutPickupPoint | null;
  selectedProvider: CheckoutShippingProvider | null;
}

export interface CheckoutQuoteLifecycle {
  hydrated: boolean;
  reconciliationMessage: string | null;
  refreshQuote: () => Promise<CheckoutQuote | null>;
}

export function useCheckoutQuoteLifecycle({
  deliveryForm,
  deliveryMethod,
  detectedLocation,
  items,
  requestQuote,
  selectedPickupPoint,
  selectedProvider,
}: CheckoutQuoteLifecycleInput): CheckoutQuoteLifecycle {
  const [hydrated, setHydrated] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);
  const quoteRequestFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      quoteRequestFingerprintRef.current = null;
      return;
    }

    const options = buildQuoteOptions(
      items,
      deliveryForm,
      deliveryMethod,
      selectedProvider,
      selectedPickupPoint,
      detectedLocation?.province,
    );
    const requestFingerprint = JSON.stringify(options);

    if (quoteRequestFingerprintRef.current === requestFingerprint) return;

    quoteRequestFingerprintRef.current = requestFingerprint;
    setReconciliationMessage(null);
    void requestQuote(options).then((nextQuote) => {
      if (!nextQuote || quoteRequestFingerprintRef.current !== requestFingerprint) return;

      quoteRequestFingerprintRef.current = JSON.stringify({
        ...options,
        items: toCheckoutLineItemsFromQuote(nextQuote),
      });
      setReconciliationMessage(getReconciliationMessage(options.items ?? [], nextQuote));
    });
  }, [
    deliveryForm,
    deliveryMethod,
    detectedLocation?.province,
    hydrated,
    items,
    requestQuote,
    selectedPickupPoint,
    selectedProvider,
  ]);

  async function refreshQuote(): Promise<CheckoutQuote | null> {
    const options = buildQuoteOptions(
      items,
      deliveryForm,
      deliveryMethod,
      selectedProvider,
      selectedPickupPoint,
      detectedLocation?.province,
    );
    const requestFingerprint = JSON.stringify(options);

    quoteRequestFingerprintRef.current = requestFingerprint;
    setReconciliationMessage(null);
    const nextQuote = await requestQuote(options);

    if (!nextQuote || quoteRequestFingerprintRef.current !== requestFingerprint) return null;

    quoteRequestFingerprintRef.current = JSON.stringify({
      ...options,
      items: toCheckoutLineItemsFromQuote(nextQuote),
    });
    setReconciliationMessage(getReconciliationMessage(options.items ?? [], nextQuote));
    return nextQuote;
  }

  return { hydrated, reconciliationMessage, refreshQuote };
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
