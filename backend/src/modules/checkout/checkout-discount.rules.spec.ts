import {
  createCheckoutUnitHarness,
  checkoutUnitCouponRecord,
  checkoutUnitShippingDiscountRecord,
} from "../../../test/support/checkout-fixtures";
import { checkoutQuoteRequestSchema } from "./checkout.schemas";

describe("CheckoutService", () => {
  it("applies coupon and automatic shipping rules from current commerce configuration", async () => {
    const harness = createCheckoutUnitHarness();
    harness.commerceRepository.checkoutCouponByCode.mockResolvedValue(checkoutUnitCouponRecord());
    harness.commerceRepository.checkoutShippingDiscounts.mockResolvedValue([checkoutUnitShippingDiscountRecord()]);
    const input = checkoutQuoteRequestSchema.parse({
      couponCode: " ten-percent ",
      items: [{ productId: "product-1", quantity: 2, variantId: "variant-1" }],
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });

    const quote = await harness.service.quote(input, harness.customerActor);

    expect(quote).toEqual(expect.objectContaining({ discount: 15, shipping: 0, subtotal: 150, total: 135 }));
    expect(quote.coupon).toEqual(expect.objectContaining({ code: "TEN-PERCENT", discountAmount: 15, result: "applied" }));
  });
});
