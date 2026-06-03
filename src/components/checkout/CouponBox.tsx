import { Button } from "@/components/ui/Button";
import { checkoutCouponCopy } from "@/lib/data/checkout";

export function CouponBox() {
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="font-subtitle text-sm font-semibold uppercase text-text">Agregá tu cupón de descuento</h3>
        <p className="mt-1 text-xs leading-5 text-text-muted">{checkoutCouponCopy.helper}</p>
      </div>
      <div className="flex overflow-hidden rounded-button border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <label className="sr-only" htmlFor="checkout-coupon">
          Cupón de descuento
        </label>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-text-muted"
          id="checkout-coupon"
          placeholder={checkoutCouponCopy.placeholder}
          type="text"
        />
        <Button className="h-11 rounded-none px-4" size="sm">
          {checkoutCouponCopy.actionLabel}
        </Button>
      </div>
    </div>
  );
}
