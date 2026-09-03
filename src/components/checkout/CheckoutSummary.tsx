"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { CouponBox } from "@/components/checkout/CouponBox";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import type { CheckoutOperationError, CheckoutQuote } from "@/lib/api/checkout/checkout.repository";
import { formatCurrency } from "@/lib/pricing";
import { checkoutRoutes } from "@/lib/routes";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";
import type { CartPreviewItem } from "@/types/cart";

type CheckoutSummaryProps = {
  actionDisabled?: boolean;
  actionHelpText?: string;
  actionHref?: string;
  discountTotal?: number;
  freeShippingRemaining?: number;
  subtotal?: number;
  actionLabel?: string;
  items?: CartPreviewItem[];
  onAction?: () => void | Promise<void>;
  onRefreshQuote?: () => void | Promise<unknown>;
  reconciliationMessage?: string | null;
  shippingCost?: number | null;
};

export function CheckoutSummary({
  actionDisabled = false,
  actionHelpText,
  actionHref = checkoutRoutes.checkout,
  actionLabel = "Iniciar Pago",
  discountTotal = 0,
  freeShippingRemaining = 0,
  items,
  onAction,
  onRefreshQuote,
  reconciliationMessage,
  shippingCost = null,
  subtotal = 0,
}: CheckoutSummaryProps) {
  const storeItems = useCartStore((state) => state.items);
  const storeQuote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const retryQuote = useCartStore((state) => state.retryQuote);
  const completionStatus = useCartStore((state) => state.completionStatus);
  const completionError = useCartStore((state) => state.completionError);
  const completionConflict = useCartStore((state) => state.completionConflict);
  const completionRetryAvailable = useCartStore((state) => state.completionRetryAvailable);
  const retryCompletion = useCartStore((state) => state.retryCompletion);
  const isCheckoutAction = Boolean(onAction);
  const quote: CheckoutQuote | null = isCheckoutAction ? storeQuote : null;
  const quoteOperationError = quoteConflict ?? quoteError;
  const completionOperationError = completionConflict ?? completionError;
  const quoteLoading = isCheckoutAction
    && (quoteStatus === CHECKOUT_ASYNC_STATUS.IDLE || quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING);
  const completionLoading = completionStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const resolvedItems = quote
    ? quote.items.map((item) => ({
      key: `${item.productId}-${item.variantId ?? item.sku}`,
      lineTotal: item.lineSubtotal,
      name: item.productName,
      quantity: item.quantity,
      variantLabel: item.variantName ?? item.sku,
    }))
    : (items ?? (isCheckoutAction ? storeItems : [])).map((item) => ({
      key: `${item.productId}-${item.variantId}`,
      lineTotal: item.price * item.quantity,
      name: item.name,
      quantity: item.quantity,
      variantLabel: item.variantLabel,
    }));
  const resolvedSubtotal = quote?.subtotal ?? subtotal;
  const resolvedDiscount = quote?.discount ?? discountTotal;
  const resolvedShipping = quote?.shipping ?? (freeShippingRemaining === 0 ? 0 : shippingCost);
  const total = quote?.total ?? resolvedSubtotal + (resolvedShipping ?? 0);
  const effectiveActionDisabled = actionDisabled
    || quoteLoading
    || completionLoading
    || (isCheckoutAction && quoteStatus !== CHECKOUT_ASYNC_STATUS.SUCCESS)
    || Boolean(completionOperationError && completionRetryAvailable);

  return (
    <aside className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="font-subtitle text-lg font-bold uppercase text-text">Resumen de Compra</h2>
      {quoteLoading ? <p className="mt-4 flex items-center gap-2 text-sm text-text-muted" role="status"><LoaderCircle aria-hidden className="animate-spin" size={16} />Validando precios, stock y entrega.</p> : null}
      {isCheckoutAction && quoteOperationError ? (
        <CheckoutOperationNotice
          busy={quoteLoading}
          error={quoteOperationError}
          title="No pudimos actualizar la cotización"
          onRetry={quoteRetryAvailable ? retryQuote : onRefreshQuote}
        />
      ) : null}
      {isCheckoutAction && completionOperationError ? (
        <CheckoutOperationNotice
          busy={completionLoading}
          error={completionOperationError}
          title={isStaleCheckoutError(completionOperationError) ? "La cotización quedó desactualizada" : "No pudimos completar la compra"}
          onRefresh={isStaleCheckoutError(completionOperationError) ? onRefreshQuote : undefined}
          onRetry={completionRetryAvailable ? retryCompletion : undefined}
        />
      ) : null}
      {isCheckoutAction && reconciliationMessage ? <p className="mt-4 rounded-card border border-border bg-background p-3 text-sm text-text-muted" role="status">{reconciliationMessage}</p> : null}
      {quote ? (
        <div className="mt-4 rounded-card border border-border bg-background p-3 text-xs text-text-muted" role="status">
          <p className="font-subtitle font-semibold uppercase text-text">Configuración confirmada · {quote.currency}</p>
          <p className="mt-1">{quote.paymentMethods.length} medios de pago · {quote.shippingOptions.length} envíos · {quote.pickupPoints.length} puntos de retiro.</p>
          {quote.warnings.length ? <ul className="mt-2 grid gap-1 text-amber-900">{quote.warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>)}</ul> : null}
        </div>
      ) : null}
      {resolvedItems.length > 0 ? (
        <div className="mt-4 max-h-48 overflow-y-auto rounded-card border border-border bg-background p-3">
          <ul className="grid gap-3">
            {resolvedItems.map((item) => (
              <li className="flex items-start justify-between gap-3 text-xs" key={item.key}>
                <div className="min-w-0"><p className="line-clamp-2 font-semibold text-text">{item.name}</p><p className="text-text-muted">{item.quantity} x {item.variantLabel}</p></div>
                <span className="shrink-0 font-subtitle font-semibold tabular-nums text-text">{formatCurrency(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5"><CouponBox /></div>
      <dl className="mt-5 grid gap-3 border-t border-border pt-5 text-sm">
        <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Subtotal</dt><dd className="font-subtitle font-semibold tabular-nums text-text">{formatCurrency(resolvedSubtotal)}</dd></div>
        {resolvedDiscount > 0 ? <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Descuento</dt><dd className="font-subtitle font-semibold tabular-nums text-accent">-{formatCurrency(resolvedDiscount)}</dd></div> : null}
        <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Envío</dt><dd className="font-subtitle font-semibold tabular-nums text-text">{resolvedShipping === null ? "A calcular" : resolvedShipping === 0 ? "Gratis" : formatCurrency(resolvedShipping)}</dd></div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4"><dt className="font-subtitle text-base font-bold uppercase text-text">Total</dt><dd className="font-subtitle text-xl font-bold tabular-nums text-text">{formatCurrency(total)}</dd></div>
      </dl>
      {onAction ? <Button aria-busy={quoteLoading || completionLoading} className="mt-5 w-full" disabled={effectiveActionDisabled} onClick={() => { if (!effectiveActionDisabled) void onAction(); }} size="lg">{quoteLoading || completionLoading ? <LoaderCircle aria-hidden className="mr-2 inline animate-spin" size={16} /> : null}{completionLoading ? "Procesando..." : quoteLoading ? "Calculando..." : actionLabel}</Button> : actionDisabled ? <Button className="mt-5 w-full" disabled size="lg">{actionLabel}</Button> : <LinkButton className="mt-5 w-full" href={actionHref} size="lg">{actionLabel}</LinkButton>}
      {actionHelpText ? <p className="mt-3 text-center text-xs font-medium text-text-muted">{actionHelpText}</p> : null}
    </aside>
  );
}

function CheckoutOperationNotice({ busy = false, error, title, onRefresh, onRetry }: { busy?: boolean; error: CheckoutOperationError; title: string; onRefresh?: () => void | Promise<unknown>; onRetry?: () => void | Promise<unknown> }) {
  return <div className="mt-4" role="alert"><Alert title={title} tone="danger"><p>{getCheckoutErrorMessage(error)}</p>{error.issues?.length ? <ul className="mt-2 grid gap-1 text-xs">{error.issues.map((issue) => <li key={`${issue.field}-${issue.code}-${issue.message}`}>{issue.message}</li>)}</ul> : null}{onRetry || onRefresh ? <div className="mt-3 flex flex-wrap gap-2">{onRetry ? <Button disabled={busy} onClick={() => { void onRetry(); }} size="sm" variant="secondary"><RefreshCw aria-hidden className="mr-2 inline" size={14} />Reintentar</Button> : null}{onRefresh ? <Button disabled={busy} onClick={() => { void onRefresh(); }} size="sm" variant="ghost"><RefreshCw aria-hidden className="mr-2 inline" size={14} />Actualizar cotización</Button> : null}</div> : null}</Alert></div>;
}

function getCheckoutErrorMessage(error: CheckoutOperationError): string {
  const messages: Record<string, string> = {
    CHECKOUT_API_INVALID_RESPONSE: "El servicio devolvió una respuesta inválida. Intentá nuevamente.",
    CHECKOUT_API_UNAVAILABLE: "El servicio de checkout no está disponible. Revisá tu conexión e intentá nuevamente.",
    CHECKOUT_SESSION_INVALID: "La sesión del checkout venció. Actualizá la cotización para reconciliar tu carrito.",
    COUPON_NOT_VALID: "El cupón ya no es válido para este checkout.",
    IDEMPOTENCY_KEY_REUSED: "La solicitud ya fue utilizada con otros datos. Actualizá la cotización antes de continuar.",
    OUT_OF_STOCK: "El stock cambió. Revisá las cantidades disponibles antes de completar la compra.",
    PAYMENT_METHOD_UNAVAILABLE: "El medio de pago seleccionado ya no está disponible.",
    PRICE_CHANGED: "El precio o el total cambió desde la última cotización.",
    SHIPPING_OPTION_UNAVAILABLE: "La opción de entrega seleccionada ya no está disponible.",
    VALIDATION_ERROR: "Revisá los datos del checkout e intentá nuevamente.",
  };
  return messages[error.code] ?? error.message;
}

function isStaleCheckoutError(error: CheckoutOperationError): boolean {
  return ["CHECKOUT_SESSION_INVALID", "OUT_OF_STOCK", "PRICE_CHANGED", "SHIPPING_OPTION_UNAVAILABLE"].includes(error.code);
}
