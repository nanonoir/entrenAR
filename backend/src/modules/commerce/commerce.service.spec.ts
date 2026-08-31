import { ConflictException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CouponStatus, ShippingDiscountTargetType, ShippingZoneTargetType } from "../../generated/prisma/enums";
import {
  FIXED_WEIGHT_BANDS,
  SHIPPING_PROVIDER,
} from "./commerce.constants";
import {
  type CouponRecord,
  type PaymentMethodRecord,
  type PickupPointRecord,
  type ShippingDiscountRecord,
  type ShippingProviderRecord,
} from "./commerce.mapper";
import type { CommerceRepository } from "./commerce.repository";
import { DiscountService } from "./services/discount.service";
import { PaymentService } from "./services/payment.service";
import { ShippingService } from "./services/shipping.service";
import { couponSchema, shippingDiscountSchema } from "./schemas/discount.schemas";
import { bankTransferSchema, paymentMethodUpdateSchema } from "./schemas/payment.schemas";
import { pickupPointUpdateSchema, shippingProviderUpdateSchema } from "./schemas/shipping.schemas";

describe("commerce services", () => {
  it("rejects bank instructions for non-bank providers before persistence", async () => {
    const harness = createPaymentHarness();
    harness.repository.paymentMethodById.mockResolvedValue(paymentRecord("mercado-pago"));

    const input = paymentMethodUpdateSchema.parse({
      bankConfig: bankTransferSchema.parse(validBankConfig()),
      selectedOptionId: "mp-instant",
      status: "active",
    });

    await expect(harness.service.update("mercado-pago", input)).rejects.toMatchObject({
      response: { code: ERROR_CODE.VALIDATION_ERROR, ok: false },
    });
    expect(harness.repository.updatePaymentMethod).not.toHaveBeenCalled();
  });

  it("requires bank instructions before activating bank transfer", async () => {
    const harness = createPaymentHarness();
    harness.repository.paymentMethodById.mockResolvedValue(paymentRecord("bank-transfer", {
      selectedOptionId: "direct-transfer",
    }));

    await expect(harness.service.update("bank-transfer", paymentMethodUpdateSchema.parse({
      selectedOptionId: "direct-transfer",
      status: "active",
    }))).rejects.toMatchObject({
      response: { code: ERROR_CODE.VALIDATION_ERROR, ok: false },
    });
    expect(harness.repository.updatePaymentMethod).not.toHaveBeenCalled();
  });

  it("persists normalized bank transfer instructions with its declared option", async () => {
    const harness = createPaymentHarness();
    const bankConfig = bankTransferSchema.parse(validBankConfig());
    harness.repository.paymentMethodById.mockResolvedValue(paymentRecord("bank-transfer"));
    harness.repository.updatePaymentMethod.mockResolvedValue(paymentRecord("bank-transfer", {
      bankConfig,
      selectedOptionId: "direct-transfer",
      status: "ACTIVE",
    }));

    const result = await harness.service.update("bank-transfer", paymentMethodUpdateSchema.parse({
      bankConfig,
      selectedOptionId: "direct-transfer",
      status: "active",
    }));

    expect(result).toEqual(expect.objectContaining({
      bankConfig,
      selectedOptionId: "direct-transfer",
      status: "active",
    }));
    expect(harness.repository.updatePaymentMethod).toHaveBeenCalledWith(expect.anything(), "bank-transfer", expect.objectContaining({
      bankConfig,
      selectedOptionId: "direct-transfer",
      status: "ACTIVE",
    }));
  });

  it("validates provider options and maps payment records without cross-provider bank data", async () => {
    const harness = createPaymentHarness();
    harness.repository.paymentMethodById.mockResolvedValue(paymentRecord("mercado-pago"));
    harness.repository.updatePaymentMethod.mockResolvedValue(paymentRecord("mercado-pago", {
      selectedOptionId: "mp-instant",
      status: "ACTIVE",
    }));

    const input = paymentMethodUpdateSchema.parse({ selectedOptionId: "mp-instant", status: "active" });
    const result = await harness.service.update("mercado-pago", input);

    expect(result).toEqual(expect.objectContaining({ id: "mercado-pago", selectedOptionId: "mp-instant", status: "active" }));
    expect(result).not.toHaveProperty("bankConfig");
    expect(harness.repository.updatePaymentMethod).toHaveBeenCalledWith(expect.anything(), "mercado-pago", expect.objectContaining({
      selectedOptionId: "mp-instant",
      status: "ACTIVE",
    }));

    await expect(harness.service.update("mercado-pago", paymentMethodUpdateSchema.parse({ selectedOptionId: "unknown", status: "inactive" }))).rejects.toMatchObject({
      response: { code: ERROR_CODE.INVALID_PROVIDER_OPTION, ok: false },
    });
  });

  it("updates only mutable provider costs and preserves fixed persisted boundaries", async () => {
    const harness = createShippingHarness();
    harness.repository.shippingProviderById.mockResolvedValue(shippingProviderRecord(SHIPPING_PROVIDER.ANDREANI));
    harness.repository.updateShippingProvider.mockResolvedValue(shippingProviderRecord(SHIPPING_PROVIDER.ANDREANI, {
      weightBands: FIXED_WEIGHT_BANDS.map((band, index) => ({
        cost: index + 10,
        id: `${SHIPPING_PROVIDER.ANDREANI}-${band.id}`,
        maxWeightGrams: band.maxGrams,
        minWeightGrams: band.minGrams,
      })),
    }));

    const input = shippingProviderUpdateSchema.parse({
      ...validProviderInput(),
      weightRanges: FIXED_WEIGHT_BANDS.map((band, index) => ({ ...band, cost: index + 10 })),
    });
    await harness.service.updateProvider(SHIPPING_PROVIDER.ANDREANI, input);

    expect(harness.repository.updateShippingProvider).toHaveBeenCalledWith(expect.anything(), SHIPPING_PROVIDER.ANDREANI, expect.objectContaining({
      weightBands: FIXED_WEIGHT_BANDS.map((band, index) => ({
        cost: index + 10,
        id: `${SHIPPING_PROVIDER.ANDREANI}-${band.id}`,
      })),
    }));
  });

  it("rejects every immutable weight-band boundary mutation before persistence", async () => {
    const harness = createShippingHarness();
    harness.repository.shippingProviderById.mockResolvedValue(shippingProviderRecord(SHIPPING_PROVIDER.ANDREANI));
    const valid = shippingProviderUpdateSchema.parse(validProviderInput());
    const invalidRanges = [
      valid.weightRanges.map((range, index) => index === 0 ? { ...range, id: "changed-id" } : range),
      valid.weightRanges.map((range, index) => index === 1 ? { ...range, minGrams: range.minGrams + 1 } : range),
      valid.weightRanges.map((range, index) => index === 2 ? { ...range, maxGrams: 9_999 } : range),
      valid.weightRanges.map((range, index) => index === 4 ? { ...range, maxGrams: 99_999 } : range),
    ];

    for (const weightRanges of invalidRanges) {
      await expect(harness.service.updateProvider(SHIPPING_PROVIDER.ANDREANI, {
        ...valid,
        weightRanges,
      } as unknown as typeof valid)).rejects.toMatchObject({
        response: { code: ERROR_CODE.INVALID_WEIGHT_RANGE, ok: false },
      });
    }

    expect(harness.repository.updateShippingProvider).not.toHaveBeenCalled();
  });

  it("locks the pickup set before replacing the main point", async () => {
    const harness = createShippingHarness();
    harness.repository.pickupPointById.mockResolvedValue(pickupRecord("pickup-2"));
    harness.repository.updatePickupPoint.mockResolvedValue(pickupRecord("pickup-2", { isMain: true }));
    const input = pickupPointUpdateSchema.parse({ ...validPickupInput(), isMain: true });

    await harness.service.updatePickupPoint("pickup-2", input);

    expect(harness.repository.lockPickupPoints.mock.invocationCallOrder[0]).toBeLessThan(
      harness.repository.pickupPointById.mock.invocationCallOrder[0]!,
    );
    expect(harness.repository.clearMainPickupPoints).toHaveBeenCalledWith(expect.anything(), "pickup-2");
    expect(harness.repository.updatePickupPoint).toHaveBeenCalledWith(expect.anything(), "pickup-2", expect.objectContaining({ isMain: true }));
  });

  it("persists fixed pickup costs and stores schedules in canonical order", async () => {
    const harness = createShippingHarness();
    harness.repository.pickupPointById.mockResolvedValue(pickupRecord("pickup-1"));
    harness.repository.updatePickupPoint.mockResolvedValue(pickupRecord("pickup-1", {
      costType: "FIXED",
      fixedCost: 125.5,
      schedules: [
        { closesAt: "18:00", dayOfWeek: "monday", id: "monday", opensAt: "09:00", sortOrder: 1 },
        { closesAt: "17:00", dayOfWeek: "friday", id: "friday", opensAt: "10:00", sortOrder: 2 },
      ],
      status: "ACTIVE",
    }));
    const input = pickupPointUpdateSchema.parse({
      ...validPickupInput(),
      costType: "fixed",
      fixedCost: 125.5,
      schedule: [
        { day: "friday", from: "10:00", id: "friday", to: "17:00" },
        { day: "monday", from: "09:00", id: "monday", to: "18:00" },
      ],
      status: "active",
    });

    await expect(harness.service.updatePickupPoint("pickup-1", input)).resolves.toEqual(expect.objectContaining({
      costType: "fixed",
      fixedCost: 125.5,
    }));
    expect(harness.repository.updatePickupPoint).toHaveBeenCalledWith(expect.anything(), "pickup-1", expect.objectContaining({
      costType: "FIXED",
      fixedCost: 125.5,
      schedules: [
        { closesAt: "18:00", dayOfWeek: "monday", id: "monday", opensAt: "09:00", sortOrder: 1 },
        { closesAt: "17:00", dayOfWeek: "friday", id: "friday", opensAt: "10:00", sortOrder: 2 },
      ],
    }));
  });

  it("derives coupon history actors from the administrator and soft-deletes without losing code reuse", async () => {
    const harness = createDiscountHarness();
    const created = couponRecord("coupon-1", { code: "WELCOME10" });
    harness.repository.couponActorById.mockResolvedValue({
      email: "admin@entrenar.test",
      firstName: "Ada",
      id: "admin-1",
      lastName: "Lovelace",
    });
    harness.repository.createCoupon.mockResolvedValue(created);
    harness.repository.couponById.mockResolvedValue({ ...created, history: [historyRecord()] });
    harness.repository.softDeleteCoupon.mockResolvedValue(true);

    const input = couponSchema.parse(validCoupon());
    const result = await harness.service.createCoupon(input, "admin-1");

    expect(result.history[0]).toEqual(expect.objectContaining({ userName: "Admin User" }));
    expect(harness.repository.createCouponHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "CREATED",
      actorId: "admin-1",
      actorName: "Ada Lovelace",
    }));
    await expect(harness.service.deleteCoupon("coupon-1")).resolves.toEqual({ ok: true });
    expect(harness.repository.softDeleteCoupon).toHaveBeenCalledWith(expect.anything(), "coupon-1");
  });

  it("turns an active coupon-code uniqueness race into a stable conflict", async () => {
    const harness = createDiscountHarness();
    harness.repository.couponActorById.mockResolvedValue({ email: "admin@entrenar.test", firstName: null, id: "admin-1", lastName: null });
    harness.repository.createCoupon.mockRejectedValue({ code: "P2002" });

    await expect(harness.service.createCoupon(couponSchema.parse(validCoupon()), "admin-1")).rejects.toMatchObject({
      response: { code: ERROR_CODE.COUPON_CODE_ALREADY_EXISTS, ok: false },
      status: 409,
    });
  });

  it("records the coupon lifecycle action for deactivation, activation, and edits", async () => {
    const scenarios = [
      { current: CouponStatus.ACTIVE, next: "inactive" as const, action: "DEACTIVATED" },
      { current: CouponStatus.INACTIVE, next: "active" as const, action: "ACTIVATED" },
      { current: CouponStatus.ACTIVE, next: "active" as const, action: "UPDATED" },
    ];

    for (const scenario of scenarios) {
      const harness = createDiscountHarness();
      const current = couponRecord(`coupon-${scenario.action.toLowerCase()}`, { status: scenario.current });
      harness.repository.couponById
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(couponRecord(current.id, { status: scenario.next === "active" ? CouponStatus.ACTIVE : CouponStatus.INACTIVE }));
      harness.repository.couponActorById.mockResolvedValue({
        email: "admin@entrenar.test",
        firstName: "Ada",
        id: "admin-1",
        lastName: "Lovelace",
      });

      await harness.service.updateCoupon(current.id, couponSchema.parse(validCoupon({ status: scenario.next })), "admin-1");

      expect(harness.repository.createCouponHistory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        action: scenario.action,
        actorId: "admin-1",
        couponId: current.id,
      }));
    }
  });

  it("rejects coupons with missing target records before persistence", async () => {
    const harness = createDiscountHarness();
    harness.repository.couponActorById.mockResolvedValue({
      email: "admin@entrenar.test",
      firstName: "Ada",
      id: "admin-1",
      lastName: "Lovelace",
    });
    harness.repository.categoryIdsExist.mockResolvedValue(false);

    await expect(harness.service.createCoupon(couponSchema.parse(validCoupon({
      categoryIds: ["missing-category"],
      targetType: "categories",
    })), "admin-1")).rejects.toMatchObject({
      response: { code: ERROR_CODE.NOT_FOUND, ok: false },
    });
    expect(harness.repository.createCoupon).not.toHaveBeenCalled();
    expect(harness.repository.createCouponHistory).not.toHaveBeenCalled();
  });

  it("keeps unsupported shipping methods outside the persistence boundary", async () => {
    const harness = createDiscountHarness();
    const input = shippingDiscountSchema.parse({
      ...validShippingDiscount(),
      shippingMethodIds: ["andreani:envío-a-domicilio"],
    });
    const invalid = { ...input, shippingMethodIds: ["unsupported:method"] } as unknown as typeof input;

    await expect(harness.service.createShippingDiscount(invalid)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.repository.createShippingDiscount).not.toHaveBeenCalled();
  });

  it("persists category and zone shipping-discount scope after validating references", async () => {
    const harness = createDiscountHarness();
    harness.repository.createShippingDiscount.mockResolvedValue(shippingDiscountRecord("shipping-1", {
      categories: [{ categoryId: "category-1" }],
      shippingMethodIds: ["andreani:envío-a-domicilio"],
      targetType: ShippingDiscountTargetType.CATEGORIES,
      zoneIds: ["ar-caba"],
      zoneTargetType: ShippingZoneTargetType.SPECIFIC,
    }));
    const input = shippingDiscountSchema.parse({
      ...validShippingDiscount(),
      categoryIds: ["category-1"],
      shippingMethodIds: ["ANDREANI:ENVIO-A-DOMICILIO"],
      targetType: "categories",
      zoneIds: ["ar-caba"],
      zoneTargetType: "specific",
    });

    await expect(harness.service.createShippingDiscount(input)).resolves.toEqual(expect.objectContaining({
      categoryIds: ["category-1"],
      shippingMethodIds: ["andreani:envío-a-domicilio"],
      targetType: "categories",
      zoneIds: ["ar-caba"],
      zoneTargetType: "specific",
    }));
    expect(harness.repository.categoryIdsExist).toHaveBeenCalledWith(expect.anything(), ["category-1"]);
    expect(harness.repository.createShippingDiscount).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      categoryIds: ["category-1"],
      shippingMethodIds: ["andreani:envío-a-domicilio"],
      targetType: ShippingDiscountTargetType.CATEGORIES,
      zoneIds: ["ar-caba"],
      zoneTargetType: ShippingZoneTargetType.SPECIFIC,
    }));
  });

  it("rejects shipping-discount categories that do not exist", async () => {
    const harness = createDiscountHarness();
    harness.repository.categoryIdsExist.mockResolvedValue(false);
    const input = shippingDiscountSchema.parse({
      ...validShippingDiscount(),
      categoryIds: ["missing-category"],
      targetType: "categories",
    });

    await expect(harness.service.createShippingDiscount(input)).rejects.toMatchObject({
      response: { code: ERROR_CODE.NOT_FOUND, ok: false },
    });
    expect(harness.repository.createShippingDiscount).not.toHaveBeenCalled();
  });
});

function createPaymentHarness() {
  const transaction = {};
  const repository = {
    paymentMethodById: jest.fn(),
    paymentMethods: jest.fn(),
    transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
    updatePaymentMethod: jest.fn(),
  };

  return { repository, service: new PaymentService(repository as unknown as CommerceRepository) };
}

function createShippingHarness() {
  const transaction = {};
  const repository = {
    clearMainPickupPoints: jest.fn(),
    lockPickupPoints: jest.fn(),
    pickupPointById: jest.fn(),
    pickupPoints: jest.fn(),
    shippingProviderById: jest.fn(),
    shippingProviders: jest.fn(),
    transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
    updatePickupPoint: jest.fn(),
    updateShippingProvider: jest.fn(),
  };

  return { repository, service: new ShippingService(repository as unknown as CommerceRepository) };
}

function createDiscountHarness() {
  const transaction = {};
  const repository = {
    categoryIdsExist: jest.fn().mockResolvedValue(true),
    couponActorById: jest.fn(),
    couponById: jest.fn(),
    coupons: jest.fn(),
    createCoupon: jest.fn(),
    createCouponHistory: jest.fn(),
    createShippingDiscount: jest.fn(),
    productIdsExist: jest.fn().mockResolvedValue(true),
    shippingDiscountById: jest.fn(),
    shippingDiscounts: jest.fn(),
    softDeleteCoupon: jest.fn(),
    softDeleteShippingDiscount: jest.fn(),
    transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
    updateCoupon: jest.fn(),
    updateShippingDiscount: jest.fn(),
  };

  return { repository, service: new DiscountService(repository as unknown as CommerceRepository) };
}

function paymentRecord(id: string, overrides: Record<string, unknown> = {}): PaymentMethodRecord {
  return {
    acceptedMethods: ["Cards"],
    bankConfig: null,
    description: "Payment provider",
    id,
    logoSrc: "/provider.svg",
    name: "Provider",
    options: [{ fee: "0%", id: id === "mercado-pago" ? "mp-instant" : "direct-transfer", receiveIn: "Now", salesIn: "Now" }],
    selectedOptionId: null,
    status: "INACTIVE" as PaymentMethodRecord["status"],
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    ...overrides,
  } as unknown as PaymentMethodRecord;
}

function shippingProviderRecord(id: string, overrides: Record<string, unknown> = {}): ShippingProviderRecord {
  return {
    enabledModalities: ["home_delivery"],
    freeShippingThreshold: null,
    id,
    name: "Andreani",
    originApartment: null,
    originCity: "Buenos Aires",
    originCuitCuil: null,
    originEmail: "origin@entrenar.test",
    originFloor: null,
    originNumber: "123",
    originPhone: "+54 11 5555-5555",
    originPostalCode: "C1000",
    originProvince: "Buenos Aires",
    originReference: null,
    originSenderName: "EntrenAR",
    originStreet: "Main Street",
    status: "NOT_CONFIGURED" as ShippingProviderRecord["status"],
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    weightBands: FIXED_WEIGHT_BANDS.map((band) => ({
      cost: 1,
      id: `${id}-${band.id}`,
      maxWeightGrams: band.maxGrams,
      minWeightGrams: band.minGrams,
      sortOrder: 1,
      updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    })),
    ...overrides,
  } as unknown as ShippingProviderRecord;
}

function pickupRecord(id: string, overrides: Record<string, unknown> = {}): PickupPointRecord {
  return {
    city: "Buenos Aires",
    contactEmail: null,
    contactName: null,
    contactPhone: null,
    costType: "FREE" as PickupPointRecord["costType"],
    coverageType: "ALL" as PickupPointRecord["coverageType"],
    fixedCost: null,
    id,
    isMain: false,
    name: "Pickup",
    number: "123",
    postalCode: "C1000",
    preparationHours: 24,
    province: "Buenos Aires",
    provinces: [],
    schedules: [{ closesAt: "18:00", dayOfWeek: "monday", id: `${id}-schedule`, opensAt: "09:00", sortOrder: 1 }],
    status: "ACTIVE" as PickupPointRecord["status"],
    street: "Main Street",
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    ...overrides,
  } as unknown as PickupPointRecord;
}

function shippingDiscountRecord(id: string, overrides: Record<string, unknown> = {}): ShippingDiscountRecord {
  return {
    canCombineWithPromotions: false,
    categories: [],
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    deletedAt: null,
    id,
    minimumCartAmount: 0,
    onlyCheapestShippingMethod: false,
    shippingMethodIds: ["andreani:envío-a-domicilio"],
    status: CouponStatus.ACTIVE,
    targetType: ShippingDiscountTargetType.ALL_STORE,
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    zoneIds: [],
    zoneTargetType: ShippingZoneTargetType.ALL,
    ...overrides,
  } as unknown as ShippingDiscountRecord;
}

function couponRecord(id: string, overrides: Record<string, unknown> = {}): CouponRecord {
  return {
    canCombineWithPromotions: false,
    categories: [],
    code: "WELCOME10",
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    customerLimitType: "UNLIMITED" as CouponRecord["customerLimitType"],
    customerUsageLimit: null,
    dateLimitType: "UNLIMITED" as CouponRecord["dateLimitType"],
    deletedAt: null,
    discountType: "PERCENTAGE" as CouponRecord["discountType"],
    discountValue: 10,
    endDate: null,
    history: [],
    id,
    includeShippingCost: false,
    maxDiscountAmount: null,
    maxDiscountType: "NONE" as CouponRecord["maxDiscountType"],
    minimumCartAmount: 0,
    products: [],
    startDate: null,
    status: "ACTIVE" as CouponRecord["status"],
    targetType: "ALL_STORE" as CouponRecord["targetType"],
    totalUsageLimit: null,
    totalUsageLimitType: "UNLIMITED" as CouponRecord["totalUsageLimitType"],
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    usageCount: 0,
    ...overrides,
  } as unknown as CouponRecord;
}

function historyRecord() {
  return { action: "CREATED" as const, actorName: "Admin User", createdAt: new Date("2026-08-30T00:00:00.000Z"), id: "history-1" };
}

function validBankConfig() {
  return { alias: "ENTRENAR.DEMO", bankName: "Banco Demo", cbuCvu: "0000000000000000000000", cuitCuil: "20-12345678-3", holderName: "Admin User" };
}

function validProviderInput() {
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
    status: "configured_inactive",
    weightRanges: FIXED_WEIGHT_BANDS.map((band, index) => ({ ...band, cost: index + 1 })),
  } as const;
}

function validPickupInput() {
  return {
    address: { city: "Buenos Aires", number: "123", postalCode: "C1000", province: "Buenos Aires", street: "Main Street" },
    costType: "free",
    coverageType: "all",
    isMain: false,
    name: "Pickup",
    preparationHours: 24,
    provinces: [],
    schedule: [{ day: "monday", from: "09:00", id: "schedule-1", to: "18:00" }],
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
  } as const;
}

function validShippingDiscount() {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    minimumCartAmount: 0,
    onlyCheapestShippingMethod: false,
    shippingMethodIds: ["andreani:envío-a-domicilio"],
    status: "active",
    targetType: "all_store",
    zoneIds: [],
    zoneTargetType: "all",
  } as const;
}
