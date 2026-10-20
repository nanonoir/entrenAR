import { ConflictException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { FIXED_WEIGHT_BANDS } from "../commerce/commerce.constants";
import type { CommerceRepository } from "../commerce/commerce.repository";
import { CheckoutDeliveryRules, type CheckoutDeliveryInput } from "./checkout-delivery.rules";
import type { ResolvedCheckoutLine } from "./checkout-line-resolver";
import type { TransactionClient } from "./checkout.repository";

const transaction = {} as TransactionClient;
const line = { totalWeightGrams: 800 } as ResolvedCheckoutLine;

describe("CheckoutDeliveryRules", () => {
  it("exposes both providers' home and branch services with exact service IDs", async () => {
    const result = await calculate({});

    expect(result.shippingOptions.map((option) => [option.id, option.providerId, option.modality])).toEqual([
      ["andreani:envío-a-domicilio", "andreani", "home_delivery"],
      ["andreani:envío-a-sucursal", "andreani", "branch_delivery"],
      ["correo-argentino:paquetería-nacional", "correo-argentino", "home_delivery"],
      ["correo-argentino:retiro-en-sucursal", "correo-argentino", "branch_delivery"],
    ]);
  });

  it("uses band costs from configuration and leaves an unselected quote at zero without a selection", async () => {
    const result = await calculate({});

    expect(result.shippingOptions.find((option) => option.id === "correo-argentino:paquetería-nacional")?.cost).toBe(12_487);
    expect(result.delivery.shippingOption).toBeUndefined();
    expect(result.delivery.snapshot).toEqual({ type: "none" });
  });

  it("selects only the exact service for a shipping delivery", async () => {
    const result = await calculate({
      deliveryType: "shipping",
      shippingMethodId: "correo-argentino:paquetería-nacional",
      shippingProviderId: "correo-argentino",
    });

    expect(result.delivery.shippingOption?.id).toBe("correo-argentino:paquetería-nacional");
    expect(result.delivery.cost).toBe(12_487);
  });

  it("rejects a service whose provider does not match", async () => {
    await expectUnavailable({
      deliveryType: "shipping",
      shippingMethodId: "andreani:envío-a-domicilio",
      shippingProviderId: "correo-argentino",
    });
  });

  it("rejects a branch service under shipping (home) delivery", async () => {
    await expectUnavailable({
      deliveryType: "shipping",
      shippingMethodId: "correo-argentino:retiro-en-sucursal",
      shippingProviderId: "correo-argentino",
    });
    await expectUnavailable({ deliveryType: "shipping", shippingMethodId: "andreani:envío-a-sucursal" });
  });

  it("resolves a provider-only selection only when exactly one eligible home service matches", async () => {
    const resolved = await calculate({ deliveryType: "shipping", shippingProviderId: "correo-argentino" });
    expect(resolved.delivery.shippingOption?.id).toBe("correo-argentino:paquetería-nacional");

    await expectUnavailable({ shippingProviderId: "correo-argentino" });
  });

  it("keeps an unknown service unavailable", async () => {
    await expectUnavailable({ deliveryType: "shipping", shippingMethodId: "correo-argentino:inexistente" });
  });
});

async function calculate(input: CheckoutDeliveryInput) {
  const rules = new CheckoutDeliveryRules({
    checkoutPickupPoints: jest.fn().mockResolvedValue([]),
    checkoutShippingProviders: jest.fn().mockResolvedValue([
      providerRecord("andreani", "Andreani", ["home_delivery", "branch_delivery"], 13_219),
      providerRecord("correo-argentino", "Correo Argentino", ["home_delivery", "branch_delivery"], 12_487),
    ]),
  } as unknown as CommerceRepository);

  return rules.calculate(transaction, input, [line], 5_000, false);
}

async function expectUnavailable(input: CheckoutDeliveryInput): Promise<void> {
  const error = await calculate(input).catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE }));
}

function providerRecord(id: string, name: string, modalities: string[], firstBandCost: number) {
  return {
    createdAt: new Date("2026-10-19T00:00:00.000Z"),
    enabledModalities: modalities,
    freeShippingThreshold: null,
    id,
    name,
    originApartment: null,
    originCity: null,
    originCuitCuil: null,
    originEmail: null,
    originFloor: null,
    originNumber: null,
    originPhone: null,
    originPostalCode: null,
    originProvince: null,
    originReference: null,
    originSenderName: null,
    originStreet: null,
    status: "ACTIVE",
    updatedAt: new Date("2026-10-19T00:00:00.000Z"),
    weightBands: FIXED_WEIGHT_BANDS.map((band, index) => ({
      cost: firstBandCost + index * 1_000,
      id: `${id}-${band.id}`,
      maxWeightGrams: band.maxGrams,
      minWeightGrams: band.minGrams,
      sortOrder: index + 1,
    })),
  };
}
