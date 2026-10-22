import { cardPaymentMethodType, type PaymentCardInput } from "./payment-card";
import type { CreateMercadoPagoOrderRequest } from "./mercadopago/mercadopago-orders.port";
import { fromCents, toCents } from "./mercadopago/mercadopago-orders.schemas";

export const PAYMENT_STATEMENT_DESCRIPTOR = "ENTRENAR";
const SHIPPING_ITEM_CODE = "SHIPPING";
const SHIPPING_ITEM_TITLE = "Envío";
const ITEM_TITLE_MAX_LENGTH = 256;
/** Provider limit for `items[].external_code`; longer SKUs are omitted rather than truncated into a misleading code. */
const ITEM_EXTERNAL_CODE_MAX_LENGTH = 30;

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
  /** Server order shipping cost; absent means no shipping line. */
  shippingCost?: { toString(): string } | number | string;
}

/** Decimal-safe money string with two places, computed through integer cents. */
export function moneyString(value: { toString(): string } | number | string): string {
  const cents = Math.round(Number(value.toString()) * 100);
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Payment amounts must be non-negative finite numbers.");
  return fromCents(cents);
}

/**
 * Product lines plus a shipping line. The provider requires the items to add up to the total exactly, so when they
 * do not (coupon discounts) the list is omitted; discounts are never redistributed and prices are never negative.
 */
function buildItems(snapshot: PaymentRequestSnapshot): CreateMercadoPagoOrderRequest["items"] | undefined {
  const items: Array<NonNullable<CreateMercadoPagoOrderRequest["items"]>[number]> = snapshot.items.map((item) => ({
    ...(item.sku.length <= ITEM_EXTERNAL_CODE_MAX_LENGTH ? { externalCode: item.sku } : {}),
    quantity: item.quantity,
    title: (item.variantName ? `${item.productName} - ${item.variantName}` : item.productName).slice(0, ITEM_TITLE_MAX_LENGTH),
    unitPrice: moneyString(item.unitPrice),
  }));
  const shipping = snapshot.shippingCost === undefined ? "0.00" : moneyString(snapshot.shippingCost);
  if (toCents(shipping) > 0) items.push({ externalCode: SHIPPING_ITEM_CODE, quantity: 1, title: SHIPPING_ITEM_TITLE, unitPrice: shipping });

  const sum = items.reduce((total, item) => total + item.quantity * toCents(item.unitPrice), 0);
  return items.length > 0 && sum === toCents(snapshot.expectedAmount) ? items : undefined;
}

/** Builds the provider request exclusively from server snapshots plus the tokenized card data. */
export function buildCreateOrderRequest(
  snapshot: PaymentRequestSnapshot,
  card: PaymentCardInput,
  deviceId: string | undefined,
): CreateMercadoPagoOrderRequest {
  const paymentMethodType = cardPaymentMethodType(card.paymentMethodId);
  if (!paymentMethodType) throw new Error("Unsupported card payment method.");

  const items = buildItems(snapshot);

  return {
    ...(deviceId ? { deviceId } : {}),
    externalReference: snapshot.orderId,
    ...(items ? { items } : {}),
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
