import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ProductBuyButtonProps = {
  productId: string;
  productSlug: string;
  className?: string;
};

export function ProductBuyButton({ productId, productSlug, className }: ProductBuyButtonProps) {
  return (
    <Button
      className={cn("h-11 w-full gap-2 text-base", className)}
      data-quick-buy-product-id={productId}
      data-quick-buy-product-slug={productSlug}
      type="button"
    >
      <span>Comprar</span>
      <ShoppingCart aria-hidden size={20} />
    </Button>
  );
}
