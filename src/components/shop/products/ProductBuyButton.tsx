import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ProductBuyButtonProps = {
  productId: string;
  productSlug: string;
  className?: string;
  disabled?: boolean;
};

export function ProductBuyButton({ productId, productSlug, className, disabled = false }: ProductBuyButtonProps) {
  return (
    <Button
      className={cn("h-11 w-full gap-2 text-base", disabled && "disabled:bg-gray-200 disabled:text-gray-700 disabled:hover:bg-gray-200 disabled:opacity-100", className)}
      disabled={disabled}
      data-quick-buy-product-id={disabled ? undefined : productId}
      data-quick-buy-product-slug={disabled ? undefined : productSlug}
      type="button"
    >
      <span>{disabled ? "Sin stock" : "Comprar"}</span>
      {disabled ? null : <ShoppingCart aria-hidden size={20} />}
    </Button>
  );
}
