import Image from "next/image";
import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type CartFreeShippingProgressProps = {
  freeShippingProgress: number;
  freeShippingRemaining: number;
  className?: string;
};

export function CartFreeShippingProgress({
  className,
  freeShippingProgress,
  freeShippingRemaining,
}: CartFreeShippingProgressProps) {
  return (
    <div className={cn("grid grid-cols-[40px_1fr] items-center gap-3", className)}>
      <Image alt="" aria-hidden height={40} src="/toFreeShip.svg" width={40} />
      <div className="min-w-0">
        <p className="text-xs leading-5 text-text-muted">
          {freeShippingRemaining > 0 ? (
            <>
              Te faltan <strong className="font-bold text-text">{formatCurrency(freeShippingRemaining)}</strong> para obtener env&iacute;o gratis.
            </>
          ) : (
            <>
              Felicidades, tenés <strong className="font-bold text-text">env&iacute;o gratis</strong> para esta compra.
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
  );
}
