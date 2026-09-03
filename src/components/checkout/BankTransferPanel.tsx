"use client";

import { LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import {
  CHECKOUT_PAYMENT_METHOD,
  type CheckoutBankTransferConfig,
} from "@/lib/api/checkout/checkout.repository";
import { bankTransferInstructions } from "@/lib/data/checkout";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";

type BankTransferPanelProps = {
  fileName: string;
  onFileSelect: (fileName: string) => void;
  open: boolean;
};

type BankTransferDisplayConfig = {
  accountHolder: string;
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
};

export function BankTransferPanel({ fileName, onFileSelect, open }: BankTransferPanelProps) {
  const quote = useCartStore((state) => state.quote);
  const quoteStatus = useCartStore((state) => state.quoteStatus);
  const quoteError = useCartStore((state) => state.quoteError);
  const quoteConflict = useCartStore((state) => state.quoteConflict);
  const quoteRetryAvailable = useCartStore((state) => state.quoteRetryAvailable);
  const retryQuote = useCartStore((state) => state.retryQuote);

  if (!open) {
    return null;
  }

  const serverQuote = quoteStatus === CHECKOUT_ASYNC_STATUS.SUCCESS ? quote : null;
  const operationError = quoteConflict ?? quoteError;
  const quoteLoading = quoteStatus === CHECKOUT_ASYNC_STATUS.LOADING;
  const isMockSource = getCheckoutDataSource() === DATA_SOURCE.MOCK;
  const serverPaymentMethod = serverQuote?.paymentMethods.find((method) => method.id === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER);
  const serverConfig = serverPaymentMethod?.bankConfig ? toDisplayConfig(serverPaymentMethod.bankConfig) : null;
  const configurationMissing = Boolean(serverQuote && (!serverPaymentMethod || !serverConfig));
  const displayConfig = serverQuote ? serverConfig : quoteLoading ? null : mockDisplayConfig();

  return (
    <div className="mt-4 rounded-card border border-accent bg-accent-soft p-4" aria-busy={quoteLoading}>
      <h3 className="font-subtitle text-lg font-bold uppercase text-accent-hover">Datos para transferencia</h3>

      {quoteLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-text-muted" role="status">
          <LoaderCircle aria-hidden className="animate-spin" size={16} />
          Actualizando la configuración bancaria.
        </p>
      ) : null}

      {operationError ? (
        <div className="mt-3 rounded-card border border-sale/40 bg-sale/10 p-3 text-sm text-sale" role="alert">
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

      {configurationMissing ? (
        <p className="mt-3 text-sm font-medium text-sale" role="alert">
          La configuración de transferencia bancaria no está disponible para esta cotización.
        </p>
      ) : null}

      {!serverQuote && !quoteLoading ? (
        <p className="mt-3 text-xs leading-5 text-text-muted" role="status">
          {isMockSource
            ? "Estos son datos mock para la vista previa; no se reciben pagos reales."
            : "Estos datos son de referencia hasta que el servidor confirme la configuración."}
        </p>
      ) : null}

      {displayConfig ? (
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Titular</dt>
            <dd className="font-semibold text-text">{displayConfig.accountHolder}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Alias</dt>
            <dd className="font-semibold text-text">{displayConfig.alias}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Banco</dt>
            <dd className="font-semibold text-text">{displayConfig.bankName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">CBU/CVU</dt>
            <dd className="break-all text-right font-semibold text-text">{displayConfig.cbuCvu}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">CUIT/CUIL</dt>
            <dd className="font-semibold text-text">{displayConfig.cuitCuil}</dd>
          </div>
        </dl>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-button border border-dashed border-accent bg-surface px-4 py-5 text-sm font-semibold text-accent-hover focus-within:ring-2 focus-within:ring-accent/20" htmlFor="checkout-transfer-proof">
        <Upload aria-hidden size={18} />
        {bankTransferInstructions.uploadLabel}
        <input
          accept="image/*,.pdf"
          aria-describedby="checkout-transfer-proof-helper"
          className="sr-only text-base md:text-sm"
          id="checkout-transfer-proof"
          onChange={(event) => onFileSelect(event.target.files?.[0]?.name ?? "")}
          type="file"
        />
      </label>
      {fileName ? <p className="mt-3 text-sm font-semibold text-text" role="status">Comprobante seleccionado: {fileName}</p> : null}
      <p className="mt-3 text-xs leading-5 text-text-muted" id="checkout-transfer-proof-helper">{bankTransferInstructions.uploadHelper}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-text">{bankTransferInstructions.note}</p>
    </div>
  );
}

function mockDisplayConfig(): BankTransferDisplayConfig {
  return {
    accountHolder: bankTransferInstructions.accountHolder,
    alias: bankTransferInstructions.alias,
    bankName: "EntrenAR Demo",
    cbuCvu: bankTransferInstructions.cbu,
    cuitCuil: "20-00000000-0",
  };
}

function toDisplayConfig(config: CheckoutBankTransferConfig): BankTransferDisplayConfig {
  return {
    accountHolder: config.holderName,
    alias: config.alias,
    bankName: config.bankName,
    cbuCvu: config.cbuCvu,
    cuitCuil: config.cuitCuil,
  };
}
