import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CatalogVisibility, Role } from "../../generated/prisma/enums";
import {
  checkoutUnitCatalogProduct,
  createCheckoutUnitHarness,
} from "../../../test/support/checkout-unit-fixtures";
import { expectCheckoutCode } from "../../../test/support/checkout-fixtures";
import { checkoutQuoteRequestSchema } from "./checkout.schemas";

describe("CheckoutService", () => {
  it("calculates quote prices from the authoritative variant and never echoes internal fields", async () => {
    const harness = createCheckoutUnitHarness();
    const input = checkoutQuoteRequestSchema.parse({
      items: [{ productId: "product-1", quantity: 2, variantId: "variant-1" }],
      sessionToken: "checkout-session-token-1",
      shippingMethodId: "andreani:envio-a-domicilio",
    });

    const quote = await harness.service.quote(input, harness.customerActor);

    expect(quote).toEqual(expect.objectContaining({
      currency: "ARS",
      discount: 0,
      ok: true,
      shipping: 100,
      subtotal: 150,
      total: 250,
    }));
    expect(quote.items[0]).toEqual(expect.objectContaining({
      lineSubtotal: 150,
      unitPrice: 75,
      variantId: "variant-1",
    }));
    expect(quote).not.toHaveProperty("lines");
    expect(quote).not.toHaveProperty("baseShipping");
    expect(quote).not.toHaveProperty("delivery");
    expect(harness.checkoutRepository.updateSessionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects hidden products before creating a quote snapshot", async () => {
    const harness = createCheckoutUnitHarness();
    harness.catalogRepository.checkoutProductById.mockResolvedValue({
      ...checkoutUnitCatalogProduct(),
      visibility: CatalogVisibility.HIDDEN,
    });
    const input = checkoutQuoteRequestSchema.parse({
      items: [{ productId: "product-1", quantity: 1, variantId: "variant-1" }],
      sessionToken: "checkout-session-token-1",
    });

    await expectCheckoutCode(harness.service.quote(input, harness.customerActor), ERROR_CODE.PRODUCT_NOT_FOUND);
    expect(harness.checkoutRepository.updateSessionSnapshot).not.toHaveBeenCalled();
  });

  it("rejects ADMIN actors and preserves the controlled error contract", async () => {
    const harness = createCheckoutUnitHarness();
    const input = checkoutQuoteRequestSchema.parse({ items: [{ productId: "product-1", quantity: 1 }] });

    await expectCheckoutCode(harness.service.quote(input, { role: Role.ADMIN, userId: "admin-1" }), ERROR_CODE.FORBIDDEN);
    expect(harness.checkoutRepository.transaction).not.toHaveBeenCalled();
  });
});
