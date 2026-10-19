"use client";

import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { FavoriteAuthModal } from "@/components/shop/account/FavoriteAuthModal";
import { ProductVariantSelector } from "@/components/shop/products/ProductVariantSelector";
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
    attributes,
    compareAtPrice,
    hasStructuredOptions,
    hasVariantSelector,
    maxQuantity,
    outOfStock,
    price,
    primaryImageId,
    quantity,
    selectedVariant,
    selectOption,
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
      <section className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ProductImageGallery
          brand={product.brand}
          images={product.images}
          activeImageId={primaryImageId}
          activeVariantId={selectedVariant?.id}
          productName={product.name}
        />
        <div className="grid min-w-0 content-start gap-6">
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
        <ProductVariantSelector
          attributes={attributes}
          hasStructuredOptions={hasStructuredOptions}
          hasVariantSelector={hasVariantSelector}
          onSelectOption={selectOption}
          onSelectVariant={selectVariant}
          selectedVariant={selectedVariant}
          variants={product.variants}
        />
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
        </div>
      </section>
      <section aria-labelledby="product-description-heading" className="mt-8 grid min-w-0 gap-3 rounded-card border border-border bg-surface p-4 sm:p-6">
        <h2 id="product-description-heading" className="font-subtitle text-lg font-semibold uppercase">Descripción</h2>
        <div
          className="min-w-0 overflow-x-auto text-sm leading-6 text-text-muted [overflow-wrap:anywhere] [&_img]:h-auto [&_img]:max-w-full [&_p]:max-w-[80ch] [&_table]:max-w-full [&_ul]:max-w-[80ch] [&_ol]:max-w-[80ch] [&_pre]:whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
      </section>
      <FavoriteAuthModal onClose={closeFavoriteAuthModal} open={favoriteAuthModalOpen} />
    </>
  );
}
