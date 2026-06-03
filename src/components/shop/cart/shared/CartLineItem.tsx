import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { getProductHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CartPreviewItem } from "@/types/cart";

type CartLineItemProps = {
  item: CartPreviewItem;
  onProductClick?: () => void;
  onRemove: (productId: string, variantId: string) => void;
  onUpdateQuantity: (productId: string, variantId: string, quantity: number) => void;
  className?: string;
};

export function CartLineItem({
  className,
  item,
  onProductClick,
  onRemove,
  onUpdateQuantity,
}: CartLineItemProps) {
  return (
    <article
      className={cn(
        "grid grid-cols-[80px_1fr] gap-3 rounded-card border border-border bg-surface p-3",
        className,
      )}
    >
      <ProductVisual brand={item.brand} className="h-24 rounded-card p-2" name={item.name} tone={item.imageTone} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              className="line-clamp-2 font-subtitle text-sm font-semibold leading-5 hover:text-accent"
              href={getProductHref(item.slug)}
              onClick={onProductClick}
            >
              {item.name}
            </Link>
            <p className="text-xs text-text-muted">{item.variantLabel}</p>
          </div>
          <Button
            aria-label={`Quitar ${item.name}`}
            onClick={() => onRemove(item.productId, item.variantId)}
            size="icon"
            variant="ghost"
          >
            <Trash2 aria-hidden size={16} />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <QuantitySelector
            max={item.stock}
            onChange={(quantity) => onUpdateQuantity(item.productId, item.variantId, quantity)}
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
  );
}
