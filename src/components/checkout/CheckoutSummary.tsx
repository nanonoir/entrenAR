import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CouponBox } from "@/components/checkout/CouponBox";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import type { CartPreviewItem } from "@/types/cart";

type CheckoutSummaryProps = {
  actionDisabled?: boolean;
  actionHelpText?: string;
  actionHref?: string;
  discountTotal: number;
  freeShippingRemaining: number;
  subtotal: number;
  actionLabel?: string;
  items?: CartPreviewItem[];
  onAction?: () => void;
  shippingCost?: number | null;
};

export function CheckoutSummary({
  actionDisabled = false,
  actionHelpText,
  actionHref = checkoutRoutes.checkout,
  actionLabel = "Iniciar Pago",
  discountTotal,
  freeShippingRemaining,
  items,
  onAction,
  shippingCost = null,
  subtotal,
}: CheckoutSummaryProps) {
  const hasFreeShipping = freeShippingRemaining === 0;
  const resolvedShippingCost = hasFreeShipping ? 0 : shippingCost;
  const total = subtotal + (resolvedShippingCost ?? 0);

  return (
    <aside className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="font-subtitle text-lg font-bold uppercase text-text">Resumen de Compra</h2>
      {items && items.length > 0 ? (
        <div className="mt-4 max-h-48 overflow-y-auto rounded-card border border-border bg-background p-3">
          <ul className="grid gap-3">
            {items.map((item) => (
              <li className="flex items-start justify-between gap-3 text-xs" key={`${item.productId}-${item.variantId}`}>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold text-text">{item.name}</p>
                  <p className="text-text-muted">{item.quantity} x {item.variantLabel}</p>
                </div>
                <span className="shrink-0 font-subtitle font-semibold tabular-nums text-text">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5">
        <CouponBox />
      </div>
      <dl className="mt-5 grid gap-3 border-t border-border pt-5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">Subtotal</dt>
          <dd className="font-subtitle font-semibold tabular-nums text-text">{formatCurrency(subtotal)}</dd>
        </div>
        {discountTotal > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-muted">Descuento</dt>
            <dd className="font-subtitle font-semibold tabular-nums text-accent">-{formatCurrency(discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">Envío</dt>
          <dd className="font-subtitle font-semibold tabular-nums text-text">
            {resolvedShippingCost === null ? "A calcular" : resolvedShippingCost === 0 ? "Gratis" : formatCurrency(resolvedShippingCost)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <dt className="font-subtitle text-base font-bold uppercase text-text">Total</dt>
          <dd className="font-subtitle text-xl font-bold tabular-nums text-text">{formatCurrency(total)}</dd>
        </div>
      </dl>
      {onAction ? (
        <Button className="mt-5 w-full" disabled={actionDisabled} onClick={onAction} size="lg">
          {actionLabel}
        </Button>
      ) : actionDisabled ? (
        <Button className="mt-5 w-full" disabled size="lg">
          {actionLabel}
        </Button>
      ) : (
        <LinkButton className="mt-5 w-full" href={actionHref} size="lg">
          {actionLabel}
        </LinkButton>
      )}
      {actionHelpText ? <p className="mt-3 text-center text-xs font-medium text-text-muted">{actionHelpText}</p> : null}
    </aside>
  );
}
