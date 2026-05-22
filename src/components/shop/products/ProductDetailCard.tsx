"use client";

import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { FavoriteAuthModal } from "@/components/shop/account/FavoriteAuthModal";
import { ProductImageGallery } from "@/components/shop/products/ProductImageGallery";
import { useFavoriteProduct } from "@/hooks/useFavoriteProduct";
import { useProductVariantSelection } from "@/hooks/useProductVariantSelection";
import { toCartPreviewItem } from "@/lib/cart-items";
import { hasFreeShipping } from "@/lib/free-shipping";
import { formatCurrency, getDiscountPercentage } from "@/lib/pricing";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";
import type { ProductDetail } from "@/types/product";

type ProductDetailCardProps = {
  product: ProductDetail;
};

export function ProductDetailCard({ product }: ProductDetailCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useUIStore((state) => state.openCart);
  const { closeFavoriteAuthModal, favoriteAuthModalOpen, favoriteFeedbackKey, isFavorite, toggleFavorite } =
    useFavoriteProduct(product.id);
  const {
    compareAtPrice,
    maxQuantity,
    outOfStock,
    price,
    quantity,
    selectedVariant,
    selectVariant,
    setQuantity,
  } = useProductVariantSelection(product);
  const discountPercentage = getDiscountPercentage(price, compareAtPrice);
  const qualifiesForFreeShipping = hasFreeShipping(price);

  function handleAddToCart() {
    if (!selectedVariant || outOfStock) {
      return;
    }

    addItem(toCartPreviewItem({ product, quantity, variant: selectedVariant }));
    openCart();
  }

  return (
    <>
      <section className="grid gap-8 xl:grid-cols-[auto_1fr]">
        <ProductImageGallery
          brand={product.brand}
          images={product.images}
          productName={product.name}
        />
        <div className="grid content-start gap-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                {qualifiesForFreeShipping ? (
                  <span className="inline-flex rounded-button bg-accent px-3 py-2 font-subtitle text-xs font-bold uppercase text-on-accent shadow-sm">
                    {"ENV\u00cdO GRATIS"}
                  </span>
                ) : null}
                <p className="mt-4 text-sm font-semibold uppercase text-text-muted">{product.brand}</p>
              </div>
              <Button
                aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                className="text-accent hover:bg-accent-soft"
                onClick={toggleFavorite}
                size="icon"
                variant="ghost"
              >
                <span className={favoriteFeedbackKey > 0 ? "favorite-pop" : ""} key={favoriteFeedbackKey}>
                  <Heart
                    aria-hidden
                    className="text-accent"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    size={22}
                  />
                </span>
              </Button>
            </div>
            <h1 className="mt-2 font-heading text-6xl leading-none sm:text-7xl">{product.name}</h1>
          </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-subtitle text-3xl font-bold tabular-nums text-text sm:text-4xl">
            {formatCurrency(price)}
          </span>
          {compareAtPrice && compareAtPrice > price ? (
            <>
              <span className="text-base font-semibold tabular-nums text-text-muted line-through sm:text-lg">
                {formatCurrency(compareAtPrice)}
              </span>
              <span className="rounded-button bg-sale px-3 py-1 font-subtitle text-sm font-bold text-white">
                {`-${discountPercentage}%`}
              </span>
            </>
          ) : null}
        </div>
        <div className="grid gap-3">
          <p className="text-sm font-medium">Variante</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((item) => (
              <button
                className={`rounded-button border px-3 py-2 text-sm font-semibold transition ${
                  item.id === selectedVariant?.id
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-border bg-surface hover:border-text"
                }`}
                disabled={item.stock <= 0}
                key={item.id}
                onClick={() => selectVariant(item.id)}
                type="button"
              >
                {item.label}
                {item.stock <= 0 ? <span className="ml-2 text-sale">Sin stock</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <QuantitySelector
            max={maxQuantity}
            onChange={setQuantity}
            value={quantity}
          />
          <Button disabled={outOfStock} onClick={handleAddToCart} size="lg">
            <ShoppingCart aria-hidden size={20} />
            Agregar al carrito
          </Button>
        </div>
        <div className="grid gap-3 rounded-card border border-border bg-surface p-4">
          <h2 className="font-subtitle text-lg font-semibold uppercase">Descripción</h2>
          <p className="text-sm leading-6 text-text-muted">{product.description}</p>
        </div>
        </div>
      </section>
      <FavoriteAuthModal onClose={closeFavoriteAuthModal} open={favoriteAuthModalOpen} />
    </>
  );
}
