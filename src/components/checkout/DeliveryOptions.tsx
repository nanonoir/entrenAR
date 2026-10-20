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
import type {
  CheckoutPickupPoint as MockCheckoutPickupPoint,
  CheckoutPostalCodeLocation,
  CheckoutShippingProvider,
} from "@/lib/data/checkout";
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
  hasFreeShipping: boolean;
  location: CheckoutPostalCodeLocation | undefined;
  onBlurField: (field: keyof DeliveryForm) => void;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onModeChange: (mode: DeliveryForm["localityMode"]) => void;
  onSelectLocality: (locality: CheckoutLocality) => void;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectPickupPoint: (point: MockCheckoutPickupPoint) => void;
  onSelectProvider: (provider: CheckoutShippingProvider) => void;
  onSelectProvince: (provinceId: string) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedProviderId: string;
};

export function DeliveryOptions({
  errors,
  form,
  hasFreeShipping,
  location,
  onBlurField,
  onFieldChange,
  onModeChange,
  onSelectLocality,
  onSelectMethod,
  onSelectPickupPoint,
  onSelectProvider,
  onSelectProvince,
  selectedMethod,
  selectedPickupPointId,
  selectedProviderId,
}: DeliveryOptionsProps) {
  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const retryQuote = useCartStore((state) => state.retryQuote);

  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const serverQuote = quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS ? quote : null;
  const shippingChoices = getShippingChoices(serverQuote);
  const pickupChoices = getPickupChoices(serverQuote, location);
  const selectedShippingUnavailable = isShippingSelectionUnavailable(serverQuote, selectedMethod === DELIVERY_METHOD.HOME, selectedProviderId, shippingChoices);
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
          hasFreeShipping={hasFreeShipping}
          onSelectProvider={onSelectProvider}
          selectedProviderId={selectedProviderId}
          selectedShippingUnavailable={selectedShippingUnavailable}
          serverQuote={serverQuote}
          shippingChoices={shippingChoices}
        />
      ) : null}

      {selectedMethod === DELIVERY_METHOD.PICKUP ? (
        <PickupOptions
          onSelectPickupPoint={onSelectPickupPoint}
          pickupChoices={pickupChoices}
          selectedPickupPointId={selectedPickupPointId}
          selectedPickupUnavailable={selectedPickupUnavailable}
          serverQuote={serverQuote}
        />
      ) : null}

    </div>
  );
}
