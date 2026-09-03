import { ERROR_CODE } from "../../common/errors/api-error.response";
import { OrderStatus, StockMode } from "../../generated/prisma/enums";
import { hashCheckoutRequest } from "./checkout.repository";
import {
  checkoutUnitCatalogProduct,
  createCheckoutUnitHarness,
  expectCheckoutCode,
} from "../../../test/support/checkout-fixtures";
import { checkoutCompleteRequestSchema, checkoutQuoteRequestSchema } from "./checkout.schemas";

describe("CheckoutService", () => {
  it("revalidates and atomically coordinates stock, snapshots, payment, cleanup, and idempotency", async () => {
    const harness = createCheckoutUnitHarness();
    const input = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      customer: { email: "customer@example.test", firstName: "Checkout", lastName: "Customer" },
      idempotencyKey: "checkout-complete-key",
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });

    const response = await harness.service.complete(input, harness.customerActor);
    const orderInput = harness.checkoutRepository.createPendingOrder.mock.calls[0]?.[1];

    expect(response).toEqual(expect.objectContaining({
      currency: "ARS",
      number: "EN-ORDER-1",
      ok: true,
      orderId: "order-1",
      status: "pending",
      total: 175,
    }));
    expect(orderInput).toEqual(expect.objectContaining({
      cartId: "cart-1",
      checkoutSessionId: "session-1",
      customerEmail: "customer@example.test",
      status: OrderStatus.PENDING,
      subtotal: 75,
      total: 175,
      userId: "customer-1",
    }));
    expect(orderInput?.items[0]).toEqual(expect.objectContaining({
      lineSubtotal: 75,
      productId: "product-1",
      unitPrice: 75,
      variantId: "variant-1",
    }));
    expect(harness.checkoutRepository.deductStockForCheckout).toHaveBeenCalledWith(
      expect.anything(),
      "product-1",
      "variant-1",
      1,
    );
    expect(harness.checkoutRepository.clearCart).toHaveBeenCalledWith(expect.anything(), "cart-1");
    expect(harness.checkoutRepository.completeSession).toHaveBeenCalledWith(expect.anything(), "session-1", expect.any(Date));
    expect(harness.checkoutRepository.completeIdempotency).toHaveBeenCalledWith(
      expect.anything(),
      "idempotency-1",
      "order-1",
      expect.objectContaining({ ok: true, orderId: "order-1" }),
      expect.any(Date),
    );
  });

  it("returns the stored response on an idempotent replay without touching the cart or stock", async () => {
    const harness = createCheckoutUnitHarness();
    const input = checkoutCompleteRequestSchema.parse({
      customer: { email: "customer@example.test", firstName: "Checkout", lastName: "Customer" },
      idempotencyKey: "checkout-replay-key",
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });
    const storedResponse = {
      currency: "ARS",
      number: "EN-ORDER-REPLAY",
      ok: true as const,
      order: { currency: "ARS" as const, id: "order-replay", number: "EN-ORDER-REPLAY", status: "pending" as const, total: 200 },
      orderId: "order-replay",
      status: "pending" as const,
      total: 200,
    };
    harness.checkoutRepository.idempotencyByOwnerAndKey.mockResolvedValue({
      completedAt: new Date(),
      id: "idempotency-replay",
      idempotencyKey: input.idempotencyKey,
      orderId: "order-replay",
      ownerKey: "user:customer-1",
      requestHash: hashCheckoutRequest(input),
      responseSnapshot: storedResponse,
      status: "COMPLETED",
    });

    await expect(harness.service.complete(input, harness.customerActor)).resolves.toEqual(storedResponse);
    expect(harness.checkoutRepository.claimIdempotency).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.resolveCart).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.deductStockForCheckout).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.clearCart).not.toHaveBeenCalled();
  });

  it("stops before order creation when the conditional stock deduction loses the race", async () => {
    const harness = createCheckoutUnitHarness();
    harness.checkoutRepository.deductStockForCheckout.mockResolvedValue({
      remainingQuantity: 0,
      status: "out-of-stock",
      target: {
        kind: "variant",
        productId: "product-1",
        quantity: 0,
        stockMode: StockMode.TRACKED,
        variantId: "variant-1",
      },
    });
    const input = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      customer: { email: "customer@example.test", firstName: "Checkout", lastName: "Customer" },
      idempotencyKey: "checkout-stock-race-key",
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      shippingMethodId: "andreani:envio-a-domicilio",
    });

    await expectCheckoutCode(harness.service.complete(input, harness.customerActor), ERROR_CODE.OUT_OF_STOCK);
    expect(harness.checkoutRepository.createPendingOrder).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.clearCart).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.completeIdempotency).not.toHaveBeenCalled();
  });

  it("rejects completion when the server quote snapshot no longer matches current catalog values", async () => {
    const harness = createCheckoutUnitHarness();
    const quoteInput = checkoutQuoteRequestSchema.parse({
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });
    const quote = await harness.service.quote(quoteInput, harness.customerActor);
    harness.catalogRepository.checkoutProductByIdForUpdate.mockResolvedValue({
      ...checkoutUnitCatalogProduct(),
      variants: [{ ...checkoutUnitCatalogProduct().variants[0]!, price: 60 }],
    });
    const completeInput = checkoutCompleteRequestSchema.parse({
      address: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", street: "123 Test Street" },
      customer: { email: "customer@example.test", firstName: "Checkout", lastName: "Customer" },
      idempotencyKey: "checkout-stale-quote-key",
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      quoteId: quote.quoteId,
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });

    await expectCheckoutCode(harness.service.complete(completeInput, harness.customerActor), ERROR_CODE.PRICE_CHANGED);
    expect(harness.checkoutRepository.deductStockForCheckout).not.toHaveBeenCalled();
    expect(harness.checkoutRepository.createPendingOrder).not.toHaveBeenCalled();
  });
});
