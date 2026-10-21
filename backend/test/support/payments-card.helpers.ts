import type { failedOrder, processedAccreditedOrder } from "../../src/modules/payments/mercadopago/__fixtures__/orders.fixtures";
import { toMercadoPagoOrder } from "../../src/modules/payments/mercadopago/mercadopago-orders.schemas";

import { checkoutJson, checkoutQuoteBody, checkoutRequest } from "./checkout-http.helpers";
import type { CheckoutQuoteResponse, ProductFixture, SessionFixture } from "./checkout-http.types";

export const CARD_SHIPPING_METHOD = "andreani:envío-a-domicilio";
export const CARD_ORDER_TOTAL = "200.00";
export const TEST_CARD = {
  installments: 1,
  payerEmail: "payer@example.test",
  payerIdentification: { number: "12345678", type: "DNI" },
  paymentMethodId: "master",
  token: "tok_e2e_123456789",
};

type FixtureOrder = typeof processedAccreditedOrder | typeof failedOrder;

const providerOrderIds = new Map<string, string>();

/** Provider order for an internal order, derived from a sanitized fixture with unique provider identifiers. */
export function providerOrder(fixture: FixtureOrder | Record<string, unknown> & { id: string }, orderId: string): ReturnType<typeof toMercadoPagoOrder> {
  const sequence = providerOrderIds.size;
  const id = `ORD-${sequence}-${orderId}`;
  providerOrderIds.set(id, orderId);
  const shaped = JSON.parse(
    JSON.stringify(fixture)
      .replaceAll("12345.67", CARD_ORDER_TOTAL)
      .replaceAll("order_internal_1", orderId)
      .replaceAll(fixture.id, id)
      .replaceAll("PAY01TESTPAYMENT00000000001", `PAY-${sequence}-${orderId}`),
  ) as Parameters<typeof toMercadoPagoOrder>[0];
  return toMercadoPagoOrder(shaped);
}

export function orderIdOf(providerOrderId: string): string {
  const orderId = providerOrderIds.get(providerOrderId);
  if (!orderId) throw new Error(`Unknown provider order ${providerOrderId}`);
  return orderId;
}

export async function buildCardBody(
  baseUrl: string,
  product: ProductFixture,
  sessionToken: string,
  session: SessionFixture | undefined,
  idempotencyKey: string,
  email = "buyer@example.test",
): Promise<Record<string, unknown>> {
  const quoteResponse = await checkoutRequest(baseUrl, "/checkout/quote", {
    body: checkoutQuoteBody(product, sessionToken, CARD_SHIPPING_METHOD),
    token: session?.accessToken,
  });
  if (quoteResponse.status !== 200) throw new Error(`Quote failed: ${quoteResponse.status} ${await quoteResponse.text()}`);
  const quote = await checkoutJson<CheckoutQuoteResponse>(quoteResponse);
  expect(JSON.stringify(quote.paymentMethods)).toContain("mercado-pago");
  return {
    address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
    card: TEST_CARD,
    customer: { email, firstName: "Checkout", lastName: "Customer" },
    deviceId: "device-e2e-1",
    idempotencyKey,
    items: [{ productId: product.productId, quantity: 1, variantId: product.variantId }],
    quoteId: quote.quoteId,
    sessionToken,
    shippingMethodId: CARD_SHIPPING_METHOD,
  };
}
