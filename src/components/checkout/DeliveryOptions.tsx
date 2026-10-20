"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { DeliveryAddressForm } from "@/components/checkout/DeliveryAddressForm";
import {
  DELIVERY_METHOD,
  DeliveryMethodOptions,
  type DeliveryMethod,
} from "@/components/checkout/DeliveryMethodOptions";
import { PickupOptions } from "@/components/checkout/PickupOptions";
import { ShippingOptions } from "@/components/checkout/ShippingOptions";
import type { DeliveryErrors, DeliveryForm } from "@/components/checkout/checkout-form.validators";
import type { CheckoutLocality } from "@/lib/data/locations/localities";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";
import {
  getPickupChoices,
  getShippingChoices,
  isPickupSelectionUnavailable,
  isShippingSelectionUnavailable,
} from "@/components/checkout/delivery-options.utils";

type DeliveryOptionsProps = {
  errors: DeliveryErrors;
  form: DeliveryForm;
  onBlurField: (field: keyof DeliveryForm) => void;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onModeChange: (mode: DeliveryForm["localityMode"]) => void;
  onSelectLocality: (locality: CheckoutLocality) => void;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectPickupPoint: (id: string) => void;
  onSelectProvince: (provinceId: string) => void;
  onSelectShipping: (selection: { id: string; providerId: string }) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedShippingId: string | null;
};

export function DeliveryOptions({
  errors,
  form,
  onBlurField,
  onFieldChange,
  onModeChange,
  onSelectLocality,
  onSelectMethod,
  onSelectPickupPoint,
  onSelectProvince,
  onSelectShipping,
  selectedMethod,
  selectedPickupPointId,
  selectedShippingId,
}: DeliveryOptionsProps) {
  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const retryQuote = useCartStore((state) => state.retryQuote);

  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  // Keep last quoted options visible while refreshing, but show neutral prices until the new quote settles.
  const serverQuote = quote && (quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS || quoteLoading) ? quote : null;
  const shippingChoices = getShippingChoices(serverQuote);
  const pickupChoices = getPickupChoices(serverQuote);
  const selectedShippingUnavailable = isShippingSelectionUnavailable(
    serverQuote,
    selectedMethod === DELIVERY_METHOD.HOME,
    selectedShippingId,
    shippingChoices,
  );
  const selectedPickupUnavailable = isPickupSelectionUnavailable(
    serverQuote,
    selectedMethod === DELIVERY_METHOD.PICKUP,
    selectedPickupPointId,
    pickupChoices,
  ) && !quoteLoading;

  return (
    <div className="grid gap-5" aria-busy={quoteLoading}>
      <DeliveryMethodOptions errorText={errors.deliveryMethod} onSelectMethod={onSelectMethod} selectedMethod={selectedMethod} />

      {quoteLoading ? (
        <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
          <LoaderCircle aria-hidden className="animate-spin" size={16} />
          Actualizando opciones de entrega, stock y precios.
        </p>
      ) : null}

      {operationError ? (
        <div className="rounded-card border border-sale/40 bg-sale/10 p-3 text-sm text-sale" role="alert">
          <p>{operationError.message}</p>
          {quoteRetryAvailable ? (
            <button
              className="mt-2 inline-flex items-center gap-2 font-semibold underline underline-offset-2"
              onClick={() => void retryQuote()}
              type="button"
            >
              <RefreshCw aria-hidden size={14} />
              Reintentar validación
            </button>
          ) : null}
        </div>
      ) : null}

      <DeliveryAddressForm
        errors={errors}
        form={form}
        onBlurField={onBlurField}
        onFieldChange={onFieldChange}
        onModeChange={onModeChange}
        onSelectLocality={onSelectLocality}
        onSelectProvince={onSelectProvince}
        selectedMethod={selectedMethod}
      />

      {selectedMethod === DELIVERY_METHOD.HOME ? (
        <ShippingOptions
          errorText={errors.shipping}
          onSelectShipping={onSelectShipping}
          quoteLoading={quoteLoading}
          quoteReady={Boolean(serverQuote)}
          selectedShippingId={selectedShippingId}
          selectedShippingUnavailable={selectedShippingUnavailable}
          shippingChoices={shippingChoices}
        />
      ) : null}

      {selectedMethod === DELIVERY_METHOD.PICKUP ? (
        <PickupOptions
          errorText={errors.pickupPoint}
          onSelectPickupPoint={onSelectPickupPoint}
          pickupChoices={pickupChoices}
          quoteReady={Boolean(serverQuote)}
          selectedPickupPointId={selectedPickupPointId}
          selectedPickupUnavailable={selectedPickupUnavailable}
        />
      ) : null}

    </div>
  );
}
