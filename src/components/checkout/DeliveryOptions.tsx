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
import type { DeliveryForm, FieldErrors } from "@/components/checkout/checkout-form.validators";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import {
  type CheckoutPickupPoint as MockCheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";
import {
  getPickupChoices,
  getShippingChoices,
  isPickupSelectionUnavailable,
  isShippingSelectionUnavailable,
} from "@/components/checkout/delivery-options.utils";

type DeliveryOptionsProps = {
  errors: FieldErrors<DeliveryForm>;
  form: DeliveryForm;
  hasFreeShipping: boolean;
  location: CheckoutPostalCodeLocation | undefined;
  onFieldChange: (field: keyof DeliveryForm, value: string) => void;
  onSelectPickupPoint: (point: MockCheckoutPickupPoint) => void;
  selectedMethod: DeliveryMethod;
  selectedPickupPointId: string | null;
  selectedProviderId: string;
  onSelectMethod: (method: DeliveryMethod) => void;
  onSelectProvider: (provider: CheckoutShippingProvider) => void;
};

export function DeliveryOptions({
  errors,
  form,
  hasFreeShipping,
  location,
  onFieldChange,
  onSelectPickupPoint,
  onSelectMethod,
  onSelectProvider,
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

  const serverQuote = quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS ? quote : null;
  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const isMockSource = getCheckoutDataSource() === DATA_SOURCE.MOCK;
  const shippingChoices = getShippingChoices(serverQuote);
  const pickupChoices = getPickupChoices(serverQuote, location);
  const selectedShippingUnavailable = isShippingSelectionUnavailable(
    serverQuote,
    selectedMethod === DELIVERY_METHOD.HOME,
    selectedProviderId,
    shippingChoices,
  );
  const selectedPickupUnavailable = isPickupSelectionUnavailable(
    serverQuote,
    selectedMethod === DELIVERY_METHOD.PICKUP,
    selectedPickupPointId,
    pickupChoices,
  );

  return (
    <div className="grid gap-5" aria-busy={quoteLoading}>
      <DeliveryMethodOptions onSelectMethod={onSelectMethod} selectedMethod={selectedMethod} />

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

      {!serverQuote && !quoteLoading ? (
        <p className="rounded-card border border-border bg-background p-3 text-xs text-text-muted" role="status">
          {isMockSource
            ? "Mostramos la configuración mock disponible para continuar con la vista previa."
            : "Las opciones se muestran como referencia hasta que el servidor confirme la configuración."}
        </p>
      ) : null}

      <DeliveryAddressForm
        errors={errors}
        form={form}
        location={location}
        onFieldChange={onFieldChange}
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
