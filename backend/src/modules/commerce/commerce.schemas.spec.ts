import {
  ARGENTINE_SHIPPING_ZONE,
  FIXED_WEIGHT_BANDS,
  PAYMENT_PROVIDER_DEFINITIONS,
} from "./commerce.constants";
import {
  couponSchema,
  shippingDiscountSchema,
} from "./schemas/discount.schemas";
import {
  bankTransferSchema,
  paymentMethodUpdateSchema,
  paymentMethodUpdateSchemaFor,
} from "./schemas/payment.schemas";
import {
  hasWeightBandOverlap,
  pickupPointUpdateSchema,
  shippingProviderUpdateSchema,
} from "./schemas/shipping.schemas";

describe("commerce schemas", () => {
  it("normalizes bank identifiers and rejects malformed bank data", () => {
    expect(bankTransferSchema.parse({
      alias: " entrenar.pagos ",
      bankName: " Banco Demo ",
      cbuCvu: "0000-0000 0000 0000 0000 00",
      cuitCuil: "20 12345678 3",
      holderName: " Ada Lovelace ",
    })).toEqual({
      alias: "entrenar.pagos",
      bankName: "Banco Demo",
      cbuCvu: "0000000000000000000000",
      cuitCuil: "20-12345678-3",
      holderName: "Ada Lovelace",
    });

    expect(bankTransferSchema.safeParse({
      alias: "alias",
      bankName: "Banco",
      cbuCvu: "123",
      cuitCuil: "20-1234567-3",
      holderName: "Holder",
    }).success).toBe(false);
    expect(paymentMethodUpdateSchema.safeParse({ status: "active", unknown: true }).success).toBe(false);
    expect(paymentMethodUpdateSchemaFor("mercado-pago").safeParse({ selectedOptionId: "unknown", status: "active" }).success).toBe(false);
    expect(paymentMethodUpdateSchemaFor("mercado-pago").safeParse({ selectedOptionId: "mp-instant", status: "active" }).success).toBe(true);
  });

  it("accepts only options declared for each payment provider", () => {
    for (const provider of PAYMENT_PROVIDER_DEFINITIONS) {
      for (const option of provider.options) {
        expect(paymentMethodUpdateSchemaFor(provider.id).safeParse({
          selectedOptionId: option.id,
          status: "active",
        }).success).toBe(true);
      }

      expect(paymentMethodUpdateSchemaFor(provider.id).safeParse({
        selectedOptionId: `${provider.id}-unsupported`,
        status: "inactive",
      }).success).toBe(false);
    }
  });

  it("keeps fixed weight boundaries immutable while allowing the open-ended final band", () => {
    const validRanges = FIXED_WEIGHT_BANDS.map((range, index) => ({ ...range, cost: index + 1 }));
    const provider = validProvider({ weightRanges: validRanges });

    expect(shippingProviderUpdateSchema.parse(provider).weightRanges.at(-1)?.maxGrams).toBeNull();
    expect(shippingProviderUpdateSchema.safeParse({
      ...provider,
      weightRanges: validRanges.map((range, index) => index === 4 ? { ...range, maxGrams: 999_999 } : range),
    }).success).toBe(false);
    expect(hasWeightBandOverlap([
      { maxGrams: 1_001, minGrams: 0 },
      { maxGrams: 3_000, minGrams: 1_000 },
    ])).toBe(true);
    expect(hasWeightBandOverlap([
      { maxGrams: 1_000, minGrams: 0 },
      { maxGrams: 3_000, minGrams: 1_000 },
    ])).toBe(false);

    expect(hasWeightBandOverlap([
      { maxGrams: 3_000, minGrams: 1_000 },
      { maxGrams: 1_000, minGrams: 0 },
    ])).toBe(false);
    expect(hasWeightBandOverlap([
      { maxGrams: null, minGrams: 0 },
      { maxGrams: 10_000, minGrams: 10_000 },
    ])).toBe(true);

    for (const [index, range] of validRanges.entries()) {
      expect(shippingProviderUpdateSchema.safeParse({
        ...provider,
        weightRanges: validRanges.map((candidate, candidateIndex) => candidateIndex === index
          ? { ...candidate, id: `${candidate.id}-changed` }
          : candidate),
      }).success).toBe(false);
      expect(shippingProviderUpdateSchema.safeParse({
        ...provider,
        weightRanges: validRanges.map((candidate, candidateIndex) => candidateIndex === index
          ? { ...candidate, minGrams: candidate.minGrams + 1 }
          : candidate),
      }).success).toBe(false);
      expect(shippingProviderUpdateSchema.safeParse({
        ...provider,
        weightRanges: validRanges.map((candidate, candidateIndex) => candidateIndex === index
          ? { ...candidate, maxGrams: range.maxGrams === null ? 99_999 : range.maxGrams + 1 }
          : candidate),
      }).success).toBe(false);
    }
  });

  it("requires complete pickup cost and schedule invariants", () => {
    const pickup = validPickup();

    expect(pickupPointUpdateSchema.parse({ ...pickup, schedule: [{ ...pickup.schedule[0]!, day: "Lunes" }] }).schedule[0]?.day).toBe("monday");
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, costType: "fixed" }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({
      ...pickup,
      schedule: [
        { day: "monday", from: "09:00", id: "morning", to: "12:00" },
        { day: "monday", from: "11:00", id: "midday", to: "15:00" },
      ],
    }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({
      ...pickup,
      schedule: [{ day: "monday", from: "18:00", id: "late", to: "09:00" }],
    }).success).toBe(false);
    expect(pickupPointUpdateSchema.parse({ ...pickup, costType: "fixed", fixedCost: 125.5 }).fixedCost).toBe(125.5);
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, costType: "free", fixedCost: 125.5 }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, coverageType: "provinces", provinces: [] }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, provinces: ["Buenos Aires"] }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, schedule: [] }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({ ...pickup, address: undefined }).success).toBe(false);
    expect(pickupPointUpdateSchema.safeParse({
      ...pickup,
      schedule: [
        { day: "monday", from: "09:00", id: "morning", to: "12:00" },
        { day: "monday", from: "12:00", id: "afternoon", to: "18:00" },
      ],
    }).success).toBe(true);
  });

  it("normalizes coupon codes and enforces target, limit, and discount rules", () => {
    expect(couponSchema.parse(validCoupon({ code: " envio-10 " })).code).toBe("ENVIO-10");
    expect(couponSchema.safeParse(validCoupon({ discountType: "percentage", discountValue: 101 })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ discountType: "free_shipping", discountValue: 1 })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ discountType: "fixed", discountValue: undefined })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ discountType: "free_shipping", discountValue: undefined })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ targetType: "categories", categoryIds: [] })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ targetType: "products", productIds: ["product-1"] })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ targetType: "products", productIds: [], categoryIds: ["category-1"] })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ totalUsageLimitType: "limited" })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ totalUsageLimitType: "limited", totalUsageLimit: 10 })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ customerLimitType: "limited", customerUsageLimit: 2 })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ customerLimitType: "first_purchase", customerUsageLimit: 1 })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ dateLimitType: "period", startDate: "2026-09-01", endDate: "2026-09-30" })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ dateLimitType: "period", startDate: "2026-09-30", endDate: "2026-09-01" })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ maxDiscountType: "amount", maxDiscountAmount: 100 })).success).toBe(true);
    expect(couponSchema.safeParse(validCoupon({ maxDiscountType: "amount" })).success).toBe(false);
    expect(couponSchema.safeParse(validCoupon({ maxDiscountType: "none", maxDiscountAmount: 100 })).success).toBe(false);
  });

  it("accepts only fixed shipping methods and zones for automatic discounts", () => {
    const valid = {
      canCombineWithPromotions: false,
      categoryIds: [],
      minimumCartAmount: 0,
      onlyCheapestShippingMethod: true,
      shippingMethodIds: [" ANDREANI:ENVIO-A-DOMICILIO "],
      status: "active",
      targetType: "all_store",
      zoneIds: [],
      zoneTargetType: "all",
    } as const;

    expect(shippingDiscountSchema.parse(valid).shippingMethodIds).toEqual(["andreani:envío-a-domicilio"]);
    expect(shippingDiscountSchema.safeParse({ ...valid, shippingMethodIds: ["unknown:service"] }).success).toBe(false);
    expect(shippingDiscountSchema.safeParse({ ...valid, zoneTargetType: "specific", zoneIds: ["ar-not-real"] }).success).toBe(false);
    expect(shippingDiscountSchema.parse({
      ...valid,
      categoryIds: ["category-1"],
      shippingMethodIds: ["CORREO-ARGENTINO:PAQUETERIA-NACIONAL"],
      targetType: "categories",
      zoneIds: [` ${ARGENTINE_SHIPPING_ZONE.CABA} `],
      zoneTargetType: "specific",
    })).toEqual(expect.objectContaining({
      categoryIds: ["category-1"],
      shippingMethodIds: ["correo-argentino:paquetería-nacional"],
      targetType: "categories",
      zoneIds: [ARGENTINE_SHIPPING_ZONE.CABA],
      zoneTargetType: "specific",
    }));
    expect(shippingDiscountSchema.safeParse({ ...valid, targetType: "categories", categoryIds: [] }).success).toBe(false);
    expect(shippingDiscountSchema.safeParse({ ...valid, categoryIds: ["category-1"] }).success).toBe(false);
    expect(shippingDiscountSchema.safeParse({ ...valid, zoneTargetType: "specific", zoneIds: [] }).success).toBe(false);
    expect(shippingDiscountSchema.safeParse({ ...valid, zoneIds: [ARGENTINE_SHIPPING_ZONE.CABA] }).success).toBe(false);
  });
});

function validProvider(overrides: Record<string, unknown> = {}) {
  return {
    enabledModalities: ["home_delivery"],
    origin: {
      city: "Buenos Aires",
      email: "origin@entrenar.test",
      number: "123",
      phone: "+54 11 5555-5555",
      postalCode: "C1000",
      province: "Buenos Aires",
      senderName: "EntrenAR",
      street: "Main Street",
    },
    status: "active",
    weightRanges: FIXED_WEIGHT_BANDS.map((range) => ({ ...range, cost: 1 })),
    ...overrides,
  };
}

function validPickup() {
  return {
    address: {
      city: "Buenos Aires",
      number: "123",
      postalCode: "C1000",
      province: "Buenos Aires",
      street: "Main Street",
    },
    costType: "free",
    coverageType: "all",
    isMain: false,
    name: "Main Pickup",
    preparationHours: 24,
    provinces: [],
    schedule: [{ day: "monday", from: "09:00", id: "monday-1", to: "18:00" }],
    status: "active",
  } as const;
}

function validCoupon(overrides: Record<string, unknown> = {}) {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    code: "WELCOME10",
    customerLimitType: "unlimited",
    dateLimitType: "unlimited",
    discountType: "percentage",
    discountValue: 10,
    includeShippingCost: false,
    maxDiscountType: "none",
    minimumCartAmount: 0,
    productIds: [],
    status: "active",
    targetType: "all_store",
    totalUsageLimitType: "unlimited",
    ...overrides,
  };
}
