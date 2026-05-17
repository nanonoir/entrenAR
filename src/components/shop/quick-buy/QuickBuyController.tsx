"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { ProductAddedModal } from "@/components/shop/quick-buy/ProductAddedModal";
import { ProductModal } from "@/components/shop/quick-buy/ProductModal";
import { getQuickBuyProductBySlug } from "@/lib/quick-buy-products";
import { useCartStore } from "@/stores/cart-store";
import type { AddedCartItemPreview, CartPreviewItem } from "@/types/cart";
import type { QuickBuyProduct } from "@/types/product";

type QuickBuyControllerProps = {
  children: ReactNode;
};

export function QuickBuyController({ children }: QuickBuyControllerProps) {
  const [selectedProduct, setSelectedProduct] = useState<QuickBuyProduct | null>(null);
  const [addedItem, setAddedItem] = useState<AddedCartItemPreview | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const requestIdRef = useRef(0);

  async function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest<HTMLButtonElement>("[data-quick-buy-product-slug]");

    if (!trigger) {
      return;
    }

    const productSlug = trigger.dataset.quickBuyProductSlug;

    if (!productSlug || loadingSlug === productSlug) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoadingSlug(productSlug);

    try {
      const product = await getQuickBuyProductBySlug(productSlug);

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (product) {
        setAddedItem(null);
        setSelectedProduct(product);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoadingSlug(null);
      }
    }
  }

  function handleClose() {
    setSelectedProduct(null);
    setAddedItem(null);
  }

  function handleAddToCart(item: CartPreviewItem) {
    addItem(item);
    setSelectedProduct(null);
    setAddedItem(item);
  }

  return (
    <div onClick={handleClick}>
      {children}
      <ProductModal
        key={selectedProduct?.id ?? "quick-buy-empty"}
        onAddToCart={handleAddToCart}
        onClose={handleClose}
        open={Boolean(selectedProduct)}
        product={selectedProduct}
      />
      <ProductAddedModal
        item={addedItem}
        onClose={handleClose}
        open={Boolean(addedItem)}
      />
    </div>
  );
}
