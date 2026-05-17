"use client";

import { useMemo } from "react";
import { getFreeShippingProgress, getFreeShippingRemaining } from "@/lib/free-shipping";
import type { CartPreviewItem } from "@/types/cart";

export function useCartTotals(items: CartPreviewItem[]) {
  return useMemo(() => {
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    const discountTotal = items.reduce((total, item) => {
      if (!item.compareAtPrice || item.compareAtPrice <= item.price) {
        return total;
      }

      return total + (item.compareAtPrice - item.price) * item.quantity;
    }, 0);

    return {
      discountTotal,
      freeShippingProgress: getFreeShippingProgress(subtotal),
      freeShippingRemaining: getFreeShippingRemaining(subtotal),
      subtotal,
    };
  }, [items]);
}
