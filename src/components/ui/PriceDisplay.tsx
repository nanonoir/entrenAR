import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type PriceDisplayProps = {
  price: number;
  compareAtPrice?: number;
  layout?: "row" | "stacked";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeStyles = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

const layoutStyles = {
  row: "flex-wrap items-baseline gap-2",
  stacked: "flex-col items-end gap-0 text-right",
};

export function PriceDisplay({
  price,
  compareAtPrice,
  layout = "row",
  size = "md",
  className,
}: PriceDisplayProps) {
  const hasCompareAtPrice = typeof compareAtPrice === "number" && compareAtPrice > price;

  return (
    <div className={cn("flex", layoutStyles[layout], className)}>
      <span className={cn("font-subtitle font-bold tabular-nums text-text", sizeStyles[size])}>
        {formatCurrency(price)}
      </span>
      {hasCompareAtPrice ? (
        <span className="text-sm font-medium tabular-nums text-text-muted line-through">
          {formatCurrency(compareAtPrice)}
        </span>
      ) : null}
    </div>
  );
}
