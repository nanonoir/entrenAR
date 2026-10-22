import { cardPaymentMethodType, type PaymentCardInput } from "./payment-card";
import type { CreateMercadoPagoOrderRequest } from "./mercadopago/mercadopago-orders.port";
import { fromCents } from "./mercadopago/mercadopago-orders.schemas";

export const PAYMENT_STATEMENT_DESCRIPTOR = "ENTRENAR";
const ITEM_TITLE_MAX_LENGTH = 256;

export interface PaymentRequestSnapshot {
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  expectedAmount: string;
  items: ReadonlyArray<{
    productName: string;
    quantity: number;
    sku: string;
    unitPrice: { toString(): string } | number | string;
    variantName: string | null;
  }>;
  orderId: string;
}

/** Decimal-safe money string with two places, computed through integer cents. */
export function moneyString(value: { toString(): string } | number | string): string {
  const cents = Math.round(Number(value.toString()) * 100);
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Payment amounts must be non-negative finite numbers.");
  return fromCents(cents);
}

/** Builds the provider request exclusively from server snapshots plus the tokenized card data. */
export function buildCreateOrderRequest(
  snapshot: PaymentRequestSnapshot,
  card: PaymentCardInput,
  deviceId: string | undefined,
): CreateMercadoPagoOrderRequest {
  const paymentMethodType = cardPaymentMethodType(card.paymentMethodId);
  if (!paymentMethodType) throw new Error("Unsupported card payment method.");

  return {
    ...(deviceId ? { deviceId } : {}),
    externalReference: snapshot.orderId,
    items: snapshot.items.map((item) => ({
      externalCode: item.sku,
      quantity: item.quantity,
      title: (item.variantName ? `${item.productName} - ${item.variantName}` : item.productName).slice(0, ITEM_TITLE_MAX_LENGTH),
      unitPrice: moneyString(item.unitPrice),
    })),
    payer: {
      email: card.payerEmail,
      firstName: snapshot.customerFirstName,
      identification: card.payerIdentification,
      lastName: snapshot.customerLastName,
    },
    payment: {
      amount: snapshot.expectedAmount,
      installments: card.installments,
      paymentMethodId: card.paymentMethodId,
      paymentMethodType,
      statementDescriptor: PAYMENT_STATEMENT_DESCRIPTOR,
      token: card.token,
    },
    totalAmount: snapshot.expectedAmount,
  };
}
