"use client";

import { CheckCircle2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Modal } from "@/components/ui/Modal";
import { OfferProductSubModal } from "@/components/shop/quick-buy/OfferProductSubModal";
import { OfferProductCard } from "@/components/shop/quick-buy/OfferProductCard";
import { HorizontalProductScroller } from "@/components/shop/products/HorizontalProductScroller";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { useCartOffers } from "@/hooks/useCartOffers";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import { useCartStore } from "@/stores/cart-store";
import type { AddedCartItemPreview } from "@/types/cart";

type ProductAddedModalProps = {
  open: boolean;
  item: AddedCartItemPreview | null;
  onClose: () => void;
};

export function ProductAddedModal({ open, item, onClose }: ProductAddedModalProps) {
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
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
    enabled: open && Boolean(item),
    excludedProductIds: item?.productId ?? [],
    items: cartItems,
    removeItem,
    updateQuantity,
  });

  if (!item) {
    return null;
  }

  return (
    <Modal className="max-w-5xl" onClose={onClose} open={open} title={"Producto a\u00f1adido al carrito"}>
      <div className="px-4 pb-5 pt-5 sm:px-8 sm:pt-8 lg:px-10 lg:py-8">
        <div className="grid grid-cols-[120px_1fr] gap-4 rounded-card border border-border p-3 sm:grid-cols-[180px_1fr] sm:items-center sm:p-4">
          <ProductVisual
            brand={item.brand}
            className="h-36 rounded-card p-2 sm:h-44 sm:p-3"
            name={item.name}
            tone={item.imageTone}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="shrink-0 text-accent" size={24} />
              <h2 className="font-subtitle text-lg font-semibold leading-6 text-text sm:text-2xl sm:leading-8">
                {"Producto a\u00f1adido al carrito"}
              </h2>
            </div>
            <h3 className="mt-3 line-clamp-2 font-subtitle text-xl font-semibold leading-6 text-text sm:text-2xl sm:leading-8">
              {item.name}
            </h3>
            <p className="mt-2 text-sm font-medium text-text-muted">{item.variantLabel}</p>
            <p className="mt-3 text-xl tabular-nums text-text">
              {item.quantity} x {formatCurrency(item.price)}
            </p>
          </div>
        </div>

        <section className="mt-4 sm:mt-5 sm:border-t sm:border-border sm:pt-4">
          <h3 className="hidden font-subtitle text-lg font-bold uppercase text-text sm:block sm:text-xl">
            Ofertas que te pueden interesar:
          </h3>
          <HorizontalProductScroller
            ariaLabel="Ofertas que te pueden interesar"
            className="mt-3"
            contentClassName="-mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-14"
          >
            {offers.map((offer) => (
              <OfferProductCard
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="h-11 px-2 text-xs leading-tight sm:h-12 sm:px-3 sm:text-base" onClick={onClose} size="lg" variant="secondary">
            Ignorar Sugerencia
          </Button>
          <LinkButton className="h-11 px-2 text-[11px] leading-tight sm:h-12 sm:px-3 sm:text-base" href={checkoutRoutes.cart} onClick={onClose} size="lg">
            <ShoppingCart aria-hidden size={20} />
            Finalizar compra
          </LinkButton>
        </div>
      </div>
      <OfferProductSubModal
        onClose={closeConfiguringOffer}
        onConfirm={handleConfirmOffer}
        open={Boolean(configuringOffer)}
        product={configuringOffer}
      />
    </Modal>
  );
}
