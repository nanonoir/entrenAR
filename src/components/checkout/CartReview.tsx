"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { CartFreeShippingProgress } from "@/components/shop/cart/shared/CartFreeShippingProgress";
import { CartLineItem } from "@/components/shop/cart/shared/CartLineItem";
import { CartSuggestedProducts } from "@/components/shop/cart/shared/CartSuggestedProducts";
import { OfferProductSubModal } from "@/components/shop/quick-buy/OfferProductSubModal";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { useCartOffers } from "@/hooks/useCartOffers";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useCartStore } from "@/stores/cart-store";

export function CartReview() {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { discountTotal, freeShippingProgress, freeShippingRemaining, subtotal } = useCartTotals(items);
  const hasCartItems = items.length > 0;
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
      <Container className="py-10" size="wide">
        <h1 className="font-title text-3xl font-bold text-text sm:text-4xl">Mi Carrito</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-4 lg:items-start">
          <section className="min-w-0 lg:col-span-3">
            <CartFreeShippingProgress
              className="rounded-card border border-border bg-surface p-4"
              freeShippingProgress={freeShippingProgress}
              freeShippingRemaining={freeShippingRemaining}
            />

            {items.length === 0 ? (
              <EmptyState
                action={<LinkButton href="/" variant="secondary">Seguir comprando</LinkButton>}
                className="mt-4"
                description="Todavía no agregaste productos. Empezá por una categoría y armá tu stack."
                title="Carrito vacío"
              />
            ) : (
              <div className="mt-4 grid gap-4">
                {items.map((item) => (
                  <CartLineItem
                    className="min-h-36"
                    item={item}
                    key={`${item.productId}-${item.variantId}`}
                    onRemove={removeItem}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>
            )}

            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-accent" href="/">
              <ArrowLeft aria-hidden size={16} />
              Seguir comprando
            </Link>

            {offers.length > 0 ? (
              <section className="mt-8">
                <h2 className="font-subtitle text-xl font-bold text-text">Completa tu compra con...</h2>
                <CartSuggestedProducts
                  ariaLabel="Productos sugeridos para completar tu compra"
                  contentClassName="mt-4"
                  getOfferQuantity={getOfferQuantity}
                  offers={offers}
                  onConfigure={setConfiguringOffer}
                  onDecrement={handleDecrementOffer}
                  onIncrement={handleIncrementOffer}
                />
              </section>
            ) : null}
          </section>

          <div className="min-w-0 lg:col-span-1">
            <CheckoutSummary
              actionDisabled={!hasCartItems}
              actionHelpText={!hasCartItems ? "Agregá al menos un producto para iniciar el pago." : undefined}
              discountTotal={discountTotal}
              freeShippingRemaining={freeShippingRemaining}
              subtotal={subtotal}
            />
          </div>
        </div>
      </Container>

      <OfferProductSubModal
        onClose={closeConfiguringOffer}
        onConfirm={handleConfirmOffer}
        open={Boolean(configuringOffer)}
        product={configuringOffer}
      />
    </>
  );
}
