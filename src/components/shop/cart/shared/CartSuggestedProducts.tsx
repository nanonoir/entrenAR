import { HorizontalProductScroller } from "@/components/shop/products/HorizontalProductScroller";
import { OfferProductCard } from "@/components/shop/quick-buy/OfferProductCard";
import type { QuickBuyProduct } from "@/types/product";

type CartSuggestedProductsProps = {
  ariaLabel: string;
  offers: QuickBuyProduct[];
  getOfferQuantity: (product: QuickBuyProduct) => number;
  onConfigure: (product: QuickBuyProduct) => void;
  onDecrement: (product: QuickBuyProduct) => void;
  onIncrement: (product: QuickBuyProduct) => void;
  contentClassName?: string;
  density?: "default" | "compact";
};

export function CartSuggestedProducts({
  ariaLabel,
  contentClassName,
  density = "default",
  getOfferQuantity,
  offers,
  onConfigure,
  onDecrement,
  onIncrement,
}: CartSuggestedProductsProps) {
  if (offers.length === 0) {
    return null;
  }

  return (
    <HorizontalProductScroller ariaLabel={ariaLabel} contentClassName={contentClassName}>
      {offers.map((offer) => (
        <OfferProductCard
          density={density}
          key={offer.id}
          onConfigure={() => onConfigure(offer)}
          onDecrement={() => onDecrement(offer)}
          onIncrement={() => onIncrement(offer)}
          product={offer}
          quantity={getOfferQuantity(offer)}
        />
      ))}
    </HorizontalProductScroller>
  );
}
