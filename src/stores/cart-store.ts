"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createCartCheckoutActions,
  createIdleCheckoutState,
  invalidateCheckoutRequests,
  type CartStoreSetter,
} from "@/stores/cart-checkout.actions";
import type { CheckoutCompletion, CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import { getPreviewCartItems } from "@/lib/data/cart-preview";
import {
  CHECKOUT_ASYNC_STATUS,
  type CheckoutCompletionOptions,
  type CheckoutQuoteOptions,
  type CheckoutState,
} from "@/stores/cart-checkout.types";
import type { CartPreviewItem } from "@/types/cart";

export { CHECKOUT_ASYNC_STATUS };
export type {
  CheckoutAsyncStatus,
  CheckoutCompletionOptions,
  CheckoutQuoteOptions,
} from "@/stores/cart-checkout.types";

export type CartState = CheckoutState & {
  activeUserEmail: string | null;
  items: CartPreviewItem[];
  addItem: (item: CartPreviewItem) => void;
  clearCart: () => void;
  clearCheckoutError: () => void;
  clearCheckoutState: () => void;
  completeCheckout: (options: CheckoutCompletionOptions) => Promise<CheckoutCompletion | null>;
  detachAuthenticatedUser: () => void;
  reconcileGuestCart: (email?: string) => Promise<boolean>;
  removeItem: (productId: string, variantId: string) => void;
  requestQuote: (options?: CheckoutQuoteOptions) => Promise<CheckoutQuote | null>;
  retryCompletion: () => Promise<CheckoutCompletion | null>;
  retryQuote: () => Promise<CheckoutQuote | null>;
  syncBeforeLogout: () => Promise<boolean>;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
};

type PersistedCartState = Pick<CartState, "items">;

function sameCartItem(item: CartPreviewItem, productId: string, variantId: string): boolean {
  return item.productId === productId && item.variantId === variantId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...createCartCheckoutActions(set, get),
      activeUserEmail: null,
      items: getPreviewCartItems(),
      addItem: (item) =>
        updateCartItems(set, (state) => {
          const existing = state.items.find((cartItem) =>
            sameCartItem(cartItem, item.productId, item.variantId),
          );

          if (!existing) return [...state.items, item];

          return state.items.map((cartItem) =>
            sameCartItem(cartItem, item.productId, item.variantId)
              ? { ...cartItem, quantity: Math.min(cartItem.stock, cartItem.quantity + item.quantity) }
              : cartItem,
          );
        }),
      clearCart: () => {
        invalidateCheckoutRequests();
        set({ items: [], ...createIdleCheckoutState(null) });
      },
      completion: null,
      completionConflict: null,
      completionError: null,
      completionRetryAvailable: false,
      completionStatus: CHECKOUT_ASYNC_STATUS.IDLE,
      detachAuthenticatedUser: () => {
        invalidateCheckoutRequests();
        set({ activeUserEmail: null, ...createIdleCheckoutState(null) });
      },
      idempotencyKey: null,
      quote: null,
      quoteConflict: null,
      quoteError: null,
      quoteRetryAvailable: false,
      quoteStatus: CHECKOUT_ASYNC_STATUS.IDLE,
      removeItem: (productId, variantId) =>
        updateCartItems(set, (state) =>
          state.items.filter((item) => !sameCartItem(item, productId, variantId)),
        ),
      updateQuantity: (productId, variantId, quantity) =>
        updateCartItems(set, (state) =>
          state.items.map((item) =>
            sameCartItem(item, productId, variantId)
              ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) }
              : item,
          ),
        ),
      checkoutSessionToken: null,
    }),
    {
      name: "entrenar-cart-preview",
      partialize: (state): PersistedCartState => ({ items: state.items }),
      skipHydration: true,
    },
  ),
);

function updateCartItems(
  set: CartStoreSetter,
  update: (state: CartState) => CartPreviewItem[],
): void {
  invalidateCheckoutRequests();
  set((state) => ({ items: update(state), ...createIdleCheckoutState(state.checkoutSessionToken) }));
}
