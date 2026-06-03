"use client";

import { useEffect, useMemo } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { LinkButton } from "@/components/ui/LinkButton";
import { CartFreeShippingProgress } from "@/components/shop/cart/shared/CartFreeShippingProgress";
import { CartLineItem } from "@/components/shop/cart/shared/CartLineItem";
import { CartSuggestedProducts } from "@/components/shop/cart/shared/CartSuggestedProducts";
import { OfferProductSubModal } from "@/components/shop/quick-buy/OfferProductSubModal";
import { useCartOffers } from "@/hooks/useCartOffers";
import { useCartTotals } from "@/hooks/useCartTotals";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";

export function CartDrawer() {
  const isOpen = useUIStore((state) => state.isCartOpen);
  const close = useUIStore((state) => state.closeCart);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { discountTotal, freeShippingProgress, freeShippingRemaining, subtotal } = useCartTotals(items);
  const excludedOfferProductIds = useMemo(() => items.map((item) => item.productId), [items]);
  const {
    closeConfiguringOffer,
    configuringOffer,
    getOfferQuantity,
    handleConfirmOffer,
    handleDecrementOffer,
    handleIncrementOffer,
    offers,
    setConfiguringOffer,
  } = useCartOffers({
    addItem,
    excludedProductIds: excludedOfferProductIds,
    items,
    removeItem,
    updateQuantity,
  });

  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  return (
    <>
      <Drawer className="md:max-w-[420px]" onClose={close} open={isOpen} title="Tu carrito">
        <div className="border-b border-border p-4">
          <CartFreeShippingProgress
            freeShippingProgress={freeShippingProgress}
            freeShippingRemaining={freeShippingRemaining}
          />
        </div>
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description="Todavía no agregaste productos. Empezá por una categoría y armá tu stack."
              title="Carrito vacío"
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {items.map((item) => (
                  <CartLineItem
                    item={item}
                    key={`${item.productId}-${item.variantId}`}
                    onProductClick={close}
                    onRemove={removeItem}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t border-border p-4">
              {offers.length > 0 ? (
                <section className="mb-4 hidden sm:block">
                  <h3 className="mb-3 font-subtitle text-sm font-bold uppercase text-text">Productos sugeridos</h3>
                  <CartSuggestedProducts
                    ariaLabel="Productos sugeridos para tu carrito"
                    contentClassName="-mx-4 px-4 lg:px-12"
                    density="compact"
                    getOfferQuantity={getOfferQuantity}
                    offers={offers}
                    onConfigure={setConfiguringOffer}
                    onDecrement={handleDecrementOffer}
                    onIncrement={handleIncrementOffer}
                  />
                </section>
              ) : null}
              <div className="mb-2 flex items-center justify-between">
                <span className="font-subtitle text-sm font-semibold uppercase">Descuento total</span>
                <span className="font-subtitle text-base font-bold tabular-nums text-accent">
                  {discountTotal > 0 ? `-${formatCurrency(discountTotal)}` : formatCurrency(0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-subtitle text-sm font-semibold uppercase">Total</span>
                <PriceDisplay price={subtotal} />
              </div>
              <LinkButton className="mt-4 w-full" href={checkoutRoutes.cart} onClick={close} size="lg">
                Iniciar Pago
              </LinkButton>
            </div>
          </div>
        )}
      </Drawer>
      <OfferProductSubModal
        onClose={closeConfiguringOffer}
        onConfirm={handleConfirmOffer}
        open={Boolean(configuringOffer)}
        product={configuringOffer}
      />
    </>
  );
}
