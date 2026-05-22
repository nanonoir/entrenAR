"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { OfferProductCard } from "@/components/shop/quick-buy/OfferProductCard";
import { OfferProductSubModal } from "@/components/shop/quick-buy/OfferProductSubModal";
import { HorizontalProductScroller } from "@/components/shop/products/HorizontalProductScroller";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { useCartOffers } from "@/hooks/useCartOffers";
import { useCartTotals } from "@/hooks/useCartTotals";
import { formatCurrency } from "@/lib/pricing";
import { getProductHref } from "@/lib/routes";
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
          <div className="grid grid-cols-[40px_1fr] items-center gap-3">
            <Image alt="" aria-hidden height={40} src="/toFreeShip.svg" width={40} />
            <div className="min-w-0">
              <p className="text-xs leading-5 text-text-muted">
                {freeShippingRemaining > 0 ? (
                  <>
                    Te faltan <strong className="font-bold text-text">{formatCurrency(freeShippingRemaining)}</strong>{" "}
                    para obtener env&iacute;o gratis.
                  </>
                ) : (
                  <>
                    Felicidades, tenés <strong className="font-bold text-text">env&iacute;o gratis</strong>!
                  </>
                )}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
          </div>
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
                  <article className="grid grid-cols-[80px_1fr] gap-3 rounded-card border border-border p-3" key={`${item.productId}-${item.variantId}`}>
                    <ProductVisual brand={item.brand} className="h-24 rounded-card p-2" name={item.name} tone={item.imageTone} />
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link className="line-clamp-2 font-subtitle text-sm font-semibold leading-5 hover:text-accent" href={getProductHref(item.slug)} onClick={close}>
                            {item.name}
                          </Link>
                          <p className="text-xs text-text-muted">{item.variantLabel}</p>
                        </div>
                        <Button
                          aria-label={`Quitar ${item.name}`}
                          onClick={() => removeItem(item.productId, item.variantId)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden size={16} />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <QuantitySelector
                          max={item.stock}
                          onChange={(quantity) => updateQuantity(item.productId, item.variantId, quantity)}
                          showLabel={false}
                          value={item.quantity}
                        />
                        <PriceDisplay
                          compareAtPrice={item.compareAtPrice ? item.compareAtPrice * item.quantity : undefined}
                          layout="stacked"
                          price={item.price * item.quantity}
                          size="sm"
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t border-border p-4">
              {offers.length > 0 ? (
                <section className="mb-4 hidden sm:block">
                  <h3 className="mb-3 font-subtitle text-sm font-bold uppercase text-text">Productos sugeridos</h3>
                  <HorizontalProductScroller
                    ariaLabel="Productos sugeridos para tu carrito"
                    contentClassName="-mx-4 px-4 lg:px-12"
                  >
                    {offers.map((offer) => (
                      <OfferProductCard
                        density="compact"
                        key={offer.id}
                        onConfigure={setConfiguringOffer}
                        onDecrement={() => handleDecrementOffer(offer)}
                        onIncrement={() => handleIncrementOffer(offer)}
                        product={offer}
                        quantity={getOfferQuantity(offer)}
                      />
                    ))}
                  </HorizontalProductScroller>
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
              <LinkButton className="mt-4 w-full" href="/finalizar-compra" onClick={close} size="lg">
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
