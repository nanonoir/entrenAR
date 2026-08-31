import { registerCommerceBoundaryScenarios } from "./commerce.e2e-boundaries";
import { registerCommerceDiscountScenarios } from "./commerce.e2e-discounts";
import { registerCommerceLifecycleScenarios } from "./commerce.e2e-lifecycle";
import { registerCommerceProtectionScenarios } from "./commerce.e2e-protection";
import { createCommerceE2eTestContext } from "./commerce.e2e-support";

const context = createCommerceE2eTestContext();

describe("commerce administration API (e2e)", () => {
  beforeAll(async () => {
    await context.start();
  });

  afterAll(async () => {
    await context.stop();
  });

  registerCommerceProtectionScenarios(context);
  registerCommerceLifecycleScenarios(context);
  registerCommerceDiscountScenarios(context);
  registerCommerceBoundaryScenarios(context);
});
