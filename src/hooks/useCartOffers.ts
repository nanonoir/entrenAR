"use client";

import { useEffect, useState } from "react";
import { getQuickBuyOfferProducts } from "@/lib/quick-buy-products";
import type { CartPreviewItem } from "@/types/cart";
import type { QuickBuyProduct } from "@/types/product";

type UseCartOffersOptions = {
  addItem: (item: CartPreviewItem) => void;
  enabled?: boolean;
  excludedProductIds: string | string[];
  items: CartPreviewItem[];
  removeItem: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
};

export function useCartOffers({
  addItem,
  enabled = true,
  excludedProductIds,
  items,
  removeItem,
  updateQuantity,
}: UseCartOffersOptions) {
  const [offers, setOffers] = useState<QuickBuyProduct[]>([]);
  const [configuringOffer, setConfiguringOffer] = useState<QuickBuyProduct | null>(null);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      Promise.resolve().then(() => {
        if (active) {
          setOffers([]);
        }
      });
      return () => {
        active = false;
      };
    }

    getQuickBuyOfferProducts(excludedProductIds).then((products) => {
      if (active) {
        setOffers(products);
      }
    });

    return () => {
      active = false;
    };
  }, [enabled, excludedProductIds]);

  function getOfferCartItems(product: QuickBuyProduct) {
    return items.filter((item) => item.productId === product.id);
  }

  function getOfferQuantity(product: QuickBuyProduct) {
    return getOfferCartItems(product).reduce((total, item) => total + item.quantity, 0);
  }

  function getPrimaryOfferCartItem(product: QuickBuyProduct) {
    return getOfferCartItems(product)[0];
  }

  function handleIncrementOffer(product: QuickBuyProduct) {
    const cartItem = getPrimaryOfferCartItem(product);

    if (!cartItem) {
      setConfiguringOffer(product);
      return;
    }

    addItem({ ...cartItem, quantity: 1 });
  }

  function handleDecrementOffer(product: QuickBuyProduct) {
    const cartItem = getPrimaryOfferCartItem(product);

    if (!cartItem) {
      return;
    }

    if (cartItem.quantity <= 1) {
      removeItem(cartItem.productId, cartItem.variantId);
      return;
    }

    updateQuantity(cartItem.productId, cartItem.variantId, cartItem.quantity - 1);
  }

  function handleConfirmOffer(cartItem: CartPreviewItem) {
    addItem(cartItem);
    setConfiguringOffer(null);
  }

  function closeConfiguringOffer() {
    setConfiguringOffer(null);
  }

  return {
    closeConfiguringOffer,
    configuringOffer,
    getOfferQuantity,
    handleConfirmOffer,
    handleDecrementOffer,
    handleIncrementOffer,
    offers,
    setConfiguringOffer,
  };
}
