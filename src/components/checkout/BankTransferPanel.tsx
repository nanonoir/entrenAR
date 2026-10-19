"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import {
  BANK_TRANSFER_UNAVAILABLE_MESSAGE,
  isUsableBankTransferConfig,
} from "@/components/checkout/bank-transfer-config";
import {
  CHECKOUT_PAYMENT_METHOD,
  type CheckoutBankTransferConfig,
} from "@/lib/api/checkout/checkout.repository";
import { CHECKOUT_ASYNC_STATUS, useCartStore } from "@/stores/cart-store";

type BankTransferPanelProps = {
  open: boolean;
};

type BankTransferDisplayConfig = {
  accountHolder: string;
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
};

export function BankTransferPanel({ open }: BankTransferPanelProps) {
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
  const serverPaymentMethod = serverQuote?.paymentMethods.find((method) => method.id === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER);
  const bankConfig = serverPaymentMethod?.bankConfig;
  const displayConfig = isUsableBankTransferConfig(bankConfig) ? toDisplayConfig(bankConfig) : null;
  const transferUnavailable = Boolean(serverQuote && !displayConfig);

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

      {transferUnavailable ? (
        <p className="mt-3 text-sm font-medium text-sale" role="alert">
          {BANK_TRANSFER_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}

      {!serverQuote && !quoteLoading ? (
        <p className="mt-3 text-xs leading-5 text-text-muted" role="status">
          Los datos para transferir se informan cuando se cotiza tu pedido.
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
    </div>
  );
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
