import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { NoopResetDelivery, RESET_DELIVERY_PORT, type ResetDeliveryPort } from "../src/modules/auth/reset-delivery.port";
import {
  expectSafeError,
  json,
  sensitiveValues,
  type CommerceE2eTestContext,
  type UnsupportedRoute,
} from "./commerce.e2e-support";

export function registerCommerceBoundaryScenarios(context: CommerceE2eTestContext): void {
  it("keeps out-of-scope provider, webhook, checkout, order, CRM, email, and mock boundaries explicit", async () => {
    const externalCalls = await context.captureExternalFetches(async () => {
      await context.withFixtures(async (fixture) => {
        const secrets = sensitiveValues(fixture);
        const paymentResponse = await context.request("/admin/payment-methods", { token: fixture.adminToken });
        expect(paymentResponse.status).toBe(200);
        await json<unknown>(paymentResponse);

        const unsupportedRoutes: UnsupportedRoute[] = [
          { method: "GET", path: "/admin/webhooks" },
          { method: "GET", path: "/admin/refunds" },
          { method: "GET", path: "/admin/reconciliation" },
          { method: "GET", path: "/admin/checkout" },
          { method: "GET", path: "/admin/orders" },
          { method: "GET", path: "/admin/sales" },
          { method: "GET", path: "/admin/crm" },
          { method: "GET", path: "/webhooks/payment" },
          { method: "GET", path: "/payments/refund" },
          { method: "GET", path: "/checkout" },
          { method: "GET", path: "/orders" },
          { method: "GET", path: "/sales" },
          { method: "GET", path: "/crm" },
        ];

        for (const route of unsupportedRoutes) {
          await expectSafeError(
            await context.request(route.path, { method: route.method, token: fixture.adminToken }),
            404,
            "NOT_FOUND",
            secrets,
          );
        }

        const resetDelivery = context.appOrThrow().get<ResetDeliveryPort>(RESET_DELIVERY_PORT);
        expect(resetDelivery).toBeInstanceOf(NoopResetDelivery);

        const retainedMockPaths = [
          resolve(__dirname, "../../src/lib/data/admin/payment-methods/index.ts"),
          resolve(__dirname, "../../src/lib/data/admin/shipping/shipping-config.ts"),
          resolve(__dirname, "../../src/lib/data/admin/discounts/types.ts"),
          resolve(__dirname, "../../src/lib/data/admin/sales-flow/sales.ts"),
          resolve(__dirname, "../../src/lib/api/commerce/mock-commerce.repository.ts"),
        ];
        for (const mockPath of retainedMockPaths) {
          expect(existsSync(mockPath)).toBe(true);
        }
      });
    });

    expect(externalCalls).toEqual([]);
  });
}
