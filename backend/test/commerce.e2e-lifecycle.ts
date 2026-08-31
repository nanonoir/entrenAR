import {
  PaymentMethodStatus,
  PickupCostType,
  PickupPointStatus,
  ShippingProviderStatus,
} from "../src/generated/prisma/enums";
import { FIXED_WEIGHT_BANDS } from "../src/modules/commerce/commerce.constants";
import {
  bankTransferInput,
  paymentMethodInput,
  pickupPointInput,
  shippingProviderInput,
} from "./commerce.e2e-fixtures";
import {
  assertNoSensitiveKeys,
  expectJson,
  expectSafeError,
  json,
  sensitiveValues,
  type CommerceE2eTestContext,
  type PaymentMethodResponse,
  type PickupPointResponse,
  type ShippingProviderResponse,
} from "./commerce.e2e-support";

export function registerCommerceLifecycleScenarios(context: CommerceE2eTestContext): void {
  it("lets an administrator complete payment, provider, and pickup lifecycles without provider calls", async () => {
    const externalCalls = await context.captureExternalFetches(async () => {
      await context.withFixtures(async (fixture) => {
        const secrets = sensitiveValues(fixture);
        const database = context.prismaOrThrow();

        const paymentResponse = await context.request("/admin/payment-methods", { token: fixture.adminToken });
        expect(paymentResponse.status).toBe(200);
        const paymentMethods = await json<PaymentMethodResponse[]>(paymentResponse);
        expect(paymentMethods).toHaveLength(4);
        assertNoSensitiveKeys(paymentMethods);
        const bankTransfer = paymentMethods.find((method) => method.id === "bank-transfer");
        const mercadoPago = paymentMethods.find((method) => method.id === "mercado-pago");
        if (!bankTransfer || !mercadoPago) throw new Error("Expected seeded payment methods.");
        expect(bankTransfer.options).toEqual(expect.arrayContaining([expect.objectContaining({ id: "direct-transfer" })]));
        for (const method of paymentMethods) {
          if (method.id !== "bank-transfer") expect(method).not.toHaveProperty("bankConfig");
        }

        const bankConfig = bankTransferInput(fixture.suffix);
        const activatedBankResponse = await context.request("/admin/payment-methods/bank-transfer", {
          body: paymentMethodInput({ bankConfig, status: "active" }),
          method: "PUT",
          token: fixture.adminToken,
        });
        expect(activatedBankResponse.status).toBe(200);
        const activatedBank = await json<PaymentMethodResponse>(activatedBankResponse);
        expect(activatedBank).toEqual(expect.objectContaining({
          bankConfig,
          id: "bank-transfer",
          selectedOptionId: "direct-transfer",
          status: "active",
        }));
        await expect(database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } })).resolves.toEqual(
          expect.objectContaining({
            selectedOptionId: "direct-transfer",
            status: PaymentMethodStatus.ACTIVE,
          }),
        );

        const deactivatedBankResponse = await context.request("/admin/payment-methods/bank-transfer", {
          body: paymentMethodInput({ status: "inactive" }),
          method: "PUT",
          token: fixture.adminToken,
        });
        expect(deactivatedBankResponse.status).toBe(200);
        await expectJson(deactivatedBankResponse, { id: "bank-transfer", status: "inactive" });

        const nonBankBeforeInvalid = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } });
        await expectSafeError(
          await context.request("/admin/payment-methods/mercado-pago", {
            body: paymentMethodInput({ bankConfig, selectedOptionId: "mp-instant" }),
            method: "PUT",
            token: fixture.adminToken,
          }),
          400,
          "VALIDATION_ERROR",
          secrets,
        );
        await expect(database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } })).resolves.toEqual(nonBankBeforeInvalid);

        const invalidOptionBefore = await database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } });
        await expectSafeError(
          await context.request("/admin/payment-methods/mercado-pago", {
            body: paymentMethodInput({ selectedOptionId: "not-supported", status: "inactive" }),
            method: "PUT",
            token: fixture.adminToken,
          }),
          409,
          "INVALID_PROVIDER_OPTION",
          secrets,
        );
        await expect(database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "mercado-pago" } })).resolves.toEqual(invalidOptionBefore);

        const providersResponse = await context.request("/admin/shipping/providers", { token: fixture.adminToken });
        expect(providersResponse.status).toBe(200);
        const providers = await json<ShippingProviderResponse[]>(providersResponse);
        expect(providers).toHaveLength(2);
        assertNoSensitiveKeys(providers);
        const andreani = providers.find((provider) => provider.id === "andreani");
        if (!andreani) throw new Error("Expected the seeded Andreani provider.");
        expect(andreani.weightRanges).toHaveLength(FIXED_WEIGHT_BANDS.length);
        expect(andreani.weightRanges.at(-1)).toEqual(expect.objectContaining({ maxGrams: null }));

        const providerInput = shippingProviderInput([1250, 1500, 1750, 2000, 2250]);
        const updatedProviderResponse = await context.request("/admin/shipping/providers/andreani", {
          body: providerInput,
          method: "PUT",
          token: fixture.adminToken,
        });
        expect(updatedProviderResponse.status).toBe(200);
        const updatedProvider = await json<ShippingProviderResponse>(updatedProviderResponse);
        expect(updatedProvider).toEqual(expect.objectContaining({ id: "andreani", status: "active" }));
        expect(updatedProvider.weightRanges.map((range) => range.cost)).toEqual([1250, 1500, 1750, 2000, 2250]);
        expect(updatedProvider.weightRanges.at(-1)).toEqual(expect.objectContaining({ maxGrams: null, minGrams: 10_000 }));
        await expect(database.shippingProvider.findUniqueOrThrow({ where: { id: "andreani" } })).resolves.toEqual(
          expect.objectContaining({ status: ShippingProviderStatus.ACTIVE }),
        );

        const providerBeforeInvalid = await database.shippingProvider.findUniqueOrThrow({
          include: { weightBands: true },
          where: { id: "andreani" },
        });
        const invalidProviderInput = {
          ...providerInput,
          weightRanges: providerInput.weightRanges.map((range, index) => index === 0 ? { ...range, id: "tampered-range" } : range),
        };
        await expectSafeError(
          await context.request("/admin/shipping/providers/andreani", {
            body: invalidProviderInput,
            method: "PUT",
            token: fixture.adminToken,
          }),
          400,
          "VALIDATION_ERROR",
          secrets,
        );
        await expect(database.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } })).resolves.toEqual(providerBeforeInvalid);

        const pickupListResponse = await context.request("/admin/pickup-points", { token: fixture.adminToken });
        expect(pickupListResponse.status).toBe(200);
        const pickupPoints = await json<PickupPointResponse[]>(pickupListResponse);
        expect(pickupPoints.some((point) => point.id === fixture.pickupPointId)).toBe(true);
        assertNoSensitiveKeys(pickupPoints);

        const activePickupInput = pickupPointInput(fixture.pickupPointId, {
          costType: "fixed",
          coverageType: "provinces",
          fixedCost: 1750,
          isMain: true,
          provinces: ["Buenos Aires", "Cordoba"],
          schedule: [
            { day: "monday", from: "09:00", id: `${fixture.pickupPointId}-monday`, to: "13:00" },
            { day: "tuesday", from: "10:00", id: `${fixture.pickupPointId}-tuesday`, to: "18:00" },
          ],
          status: "active",
        });
        const updatedPickupResponse = await context.request(`/admin/pickup-points/${fixture.pickupPointId}`, {
          body: activePickupInput,
          method: "PUT",
          token: fixture.adminToken,
        });
        expect(updatedPickupResponse.status).toBe(200);
        const updatedPickup = await json<PickupPointResponse>(updatedPickupResponse);
        expect(updatedPickup).toEqual(expect.objectContaining({
          costType: "fixed",
          fixedCost: 1750,
          id: fixture.pickupPointId,
          isMain: true,
          status: "active",
        }));
        expect(updatedPickup.schedule).toHaveLength(2);
        await expect(database.pickupPoint.findUniqueOrThrow({ where: { id: fixture.pickupPointId } })).resolves.toEqual(
          expect.objectContaining({
            costType: PickupCostType.FIXED,
            fixedCost: expect.anything(),
            isMain: true,
            status: PickupPointStatus.ACTIVE,
          }),
        );
        const mainPoints = await database.pickupPoint.findMany({ orderBy: { id: "asc" }, select: { id: true }, where: { isMain: true } });
        expect(mainPoints).toEqual([{ id: fixture.pickupPointId }]);

        const configuredInactiveResponse = await context.request(`/admin/pickup-points/${fixture.pickupPointId}`, {
          body: pickupPointInput(fixture.pickupPointId, {
            coverageType: "all",
            isMain: false,
            provinces: [],
            status: "configured_inactive",
          }),
          method: "PUT",
          token: fixture.adminToken,
        });
        expect(configuredInactiveResponse.status).toBe(200);
        await expectJson(configuredInactiveResponse, { costType: "free", isMain: false, status: "configured_inactive" });

        const pickupBeforeInvalid = await database.pickupPoint.findUniqueOrThrow({ include: { schedules: true }, where: { id: fixture.pickupPointId } });
        await expectSafeError(
          await context.request(`/admin/pickup-points/${fixture.pickupPointId}`, {
            body: pickupPointInput(fixture.pickupPointId, { schedule: [] }),
            method: "PUT",
            token: fixture.adminToken,
          }),
          400,
          "VALIDATION_ERROR",
          secrets,
        );
        await expect(database.pickupPoint.findUniqueOrThrow({ include: { schedules: true }, where: { id: fixture.pickupPointId } })).resolves.toEqual(pickupBeforeInvalid);

        await expectSafeError(
          await context.request("/admin/payment-methods/missing-payment-method", {
            body: paymentMethodInput(),
            method: "PUT",
            token: fixture.adminToken,
          }),
          404,
          "NOT_FOUND",
          secrets,
        );
        await expectSafeError(
          await context.request("/admin/shipping/providers/missing-provider", {
            body: providerInput,
            method: "PUT",
            token: fixture.adminToken,
          }),
          404,
          "NOT_FOUND",
          secrets,
        );
        await expectSafeError(
          await context.request(`/admin/pickup-points/missing-${fixture.suffix}`, {
            body: pickupPointInput(`missing-${fixture.suffix}`),
            method: "PUT",
            token: fixture.adminToken,
          }),
          404,
          "NOT_FOUND",
          secrets,
        );
      });
    });

    expect(externalCalls).toEqual([]);
  });
}
