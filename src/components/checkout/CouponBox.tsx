"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import {
  CHECKOUT_COUPON_RESULT,
  type CheckoutQuote,
  type CheckoutShippingOption,
} from "@/lib/api/checkout/checkout.repository";
import { checkoutCouponCopy } from "@/lib/data/checkout";
import { formatCurrency } from "@/lib/pricing";
import { CHECKOUT_ASYNC_STATUS, type CheckoutQuoteOptions, useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

export function CouponBox() {
  const [couponCode, setCouponCode] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const requestQuote = useCartStore((state) => state.requestQuote);
  const retryQuote = useCartStore((state) => state.retryQuote);

  const serverQuote = quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS ? quote : null;
  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const isMockSource = getCheckoutDataSource() === DATA_SOURCE.MOCK;
  const couponResult = serverQuote?.coupon;
  const rejectedCouponMessage = couponResult?.result === CHECKOUT_COUPON_RESULT.REJECTED
    ? couponResult.message ?? "El cupón no es válido para este pedido."
    : null;
  const errorMessage = validationMessage ?? operationError?.message ?? rejectedCouponMessage;
  const helperId = "checkout-coupon-helper";
  const errorId = "checkout-coupon-error";

  async function applyCoupon(): Promise<void> {
    setSubmitAttempted(true);
    const normalizedCode = couponCode.trim().toLocaleUpperCase();

    if (!normalizedCode) {
      setValidationMessage("Ingresá un código de cupón.");
      return;
    }

    setValidationMessage(null);
    setIsApplying(true);

    try {
      const nextQuote = await requestQuote(buildCouponQuoteOptions(serverQuote, normalizedCode));
      if (nextQuote?.coupon?.result === CHECKOUT_COUPON_RESULT.REJECTED) {
        setValidationMessage(nextQuote.coupon.message ?? "El cupón no es válido para este pedido.");
      }
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void applyCoupon(); }}>
      <div>
        <h3 className="font-subtitle text-sm font-semibold uppercase text-text">{checkoutCouponCopy.title}</h3>
        <label className="mt-2 block text-sm font-medium text-text" htmlFor="checkout-coupon">
          Código de cupón
        </label>
        <p className="mt-1 text-xs leading-5 text-text-muted" id={helperId}>
          {serverQuote ? "El servidor valida el cupón y calcula el descuento antes de continuar." : checkoutCouponCopy.helper}
        </p>
      </div>
      <div className={cn(
        "flex overflow-hidden rounded-button border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
        errorMessage && "border-sale focus-within:border-sale focus-within:ring-sale/20",
      )}>
        <input
          aria-describedby={errorMessage ? `${helperId} ${errorId}` : helperId}
          aria-invalid={errorMessage ? true : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-text-muted md:text-sm",
            errorMessage && "text-sale",
          )}
          id="checkout-coupon"
          onChange={(event) => {
            setCouponCode(event.target.value);
            if (submitAttempted) setValidationMessage(null);
          }}
          placeholder={checkoutCouponCopy.placeholder}
          type="text"
          value={couponCode}
        />
        <Button
          aria-busy={isApplying || quoteLoading}
          className="h-11 rounded-none px-4"
          disabled={isApplying || quoteLoading}
          size="sm"
          type="submit"
        >
          {isApplying || quoteLoading ? <LoaderCircle aria-hidden className="mr-2 inline animate-spin" size={16} /> : null}
          {isApplying || quoteLoading ? "Validando" : checkoutCouponCopy.actionLabel}
        </Button>
      </div>
      {errorMessage ? <p className="text-xs font-medium text-sale" id={errorId} role="alert">{errorMessage}</p> : null}
      {quoteRetryAvailable ? (
        <button
          className="inline-flex items-center gap-2 justify-self-start text-xs font-semibold text-accent-hover underline underline-offset-2"
          onClick={() => void retryQuote()}
          type="button"
        >
          <RefreshCw aria-hidden size={14} />
          Reintentar validación
        </button>
      ) : null}
      {couponResult?.result === CHECKOUT_COUPON_RESULT.APPLIED && couponResult.code ? (
        <p className="rounded-card border border-accent/40 bg-accent-soft p-3 text-sm font-semibold text-accent-hover" role="status">
          Cupón {couponResult.code} aplicado: -{formatCurrency(couponResult.discountAmount)}.
        </p>
      ) : null}
      {serverQuote && serverQuote.discount > 0 && couponResult?.result !== CHECKOUT_COUPON_RESULT.APPLIED ? (
        <p className="rounded-card border border-accent/40 bg-accent-soft p-3 text-sm font-semibold text-accent-hover" role="status">
          Descuento confirmado por el servidor: -{formatCurrency(serverQuote.discount)}.
        </p>
      ) : null}
      {!serverQuote && !quoteLoading ? (
        <p className="text-xs text-text-muted" role="status">
          {isMockSource ? "La vista previa usa la validación mock disponible." : "La validación final depende de la respuesta del servidor."}
        </p>
      ) : null}
    </form>
  );
}

function buildCouponQuoteOptions(quote: CheckoutQuote | null, couponCode: string): CheckoutQuoteOptions {
  const shippingOption = quote && quote.shipping > 0
    ? quote.shippingOptions.find((option) => option.cost === quote.shipping)
    : undefined;

  return {
    couponCode,
    ...(shippingOption ? toShippingSelection(shippingOption) : {}),
  };
}

function toShippingSelection(option: CheckoutShippingOption): Pick<CheckoutQuoteOptions, "deliveryType" | "shippingMethodId" | "shippingProviderId"> {
  return {
    deliveryType: "shipping",
    shippingMethodId: option.id,
    shippingProviderId: option.providerId,
  };
}
