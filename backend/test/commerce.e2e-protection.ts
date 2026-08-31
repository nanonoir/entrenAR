import {
  couponInput,
  paymentMethodInput,
  pickupPointInput,
  shippingDiscountInput,
  shippingProviderInput,
  type FixtureRecords,
} from "./commerce.e2e-fixtures";
import {
  expectProtectedError,
  sensitiveValues,
  type CommerceE2eTestContext,
  type ProtectedRoute,
} from "./commerce.e2e-support";

export function registerCommerceProtectionScenarios(context: CommerceE2eTestContext): void {
  it("denies every commerce admin route without leaking data or allowing mutation", async () => {
    await context.withFixtures(async (fixture) => {
      const initialState = await context.readCommerceState(fixture.adminToken);
      const secrets = sensitiveValues(fixture);

      for (const route of protectedRoutes(fixture)) {
        await expectProtectedError(
          await context.request(route.path, { body: route.body, method: route.method }),
          401,
          "UNAUTHORIZED",
          secrets,
        );
        await expectProtectedError(
          await context.request(route.path, { body: route.body, method: route.method, token: fixture.customerToken }),
          403,
          "FORBIDDEN",
          secrets,
        );
      }

      await expect(context.readCommerceState(fixture.adminToken)).resolves.toEqual(initialState);
    });
  });
}

function protectedRoutes(fixtures: Pick<FixtureRecords, "couponCode" | "couponId" | "pickupPointId" | "shippingDiscountId" | "suffix">): ProtectedRoute[] {
  return [
    { method: "GET", path: "/admin/payment-methods" },
    { body: paymentMethodInput(), method: "PUT", path: "/admin/payment-methods/bank-transfer" },
    { method: "GET", path: "/admin/shipping/providers" },
    { body: shippingProviderInput(), method: "PUT", path: "/admin/shipping/providers/andreani" },
    { method: "GET", path: "/admin/pickup-points" },
    { body: pickupPointInput(fixtures.pickupPointId), method: "PUT", path: `/admin/pickup-points/${fixtures.pickupPointId}` },
    { method: "GET", path: "/admin/discounts/coupons" },
    { body: couponInput(`PROTECTION-CREATE-${fixtures.suffix}`), method: "POST", path: "/admin/discounts/coupons" },
    { body: couponInput(fixtures.couponCode), method: "PUT", path: `/admin/discounts/coupons/${fixtures.couponId}` },
    { method: "DELETE", path: `/admin/discounts/coupons/${fixtures.couponId}` },
    { method: "GET", path: "/admin/discounts/shipping" },
    { body: shippingDiscountInput(), method: "POST", path: "/admin/discounts/shipping" },
    { body: shippingDiscountInput(), method: "PUT", path: `/admin/discounts/shipping/${fixtures.shippingDiscountId}` },
    { method: "DELETE", path: `/admin/discounts/shipping/${fixtures.shippingDiscountId}` },
  ];
}
