import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";

import { Prisma } from "../src/generated/prisma/client";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  PickupCostType,
  PickupCoverageType,
  PickupPointStatus,
  Role,
  ShippingDiscountTargetType,
  ShippingZoneTargetType,
} from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { FIXED_WEIGHT_BANDS } from "../src/modules/commerce/commerce.constants";
import type { BankTransferResponse, WeightBandResponse } from "./commerce.e2e-support";

export async function createFixtures(database: PrismaService): Promise<FixtureRecords> {
  const suffix = randomUUID().replaceAll("-", "");
  const password = `Commerce-${suffix}-A1!`;
  const admin = {
    email: `commerce-e2e-admin-${suffix}@example.test`,
    id: `commerce-e2e-admin-${suffix}`,
    password,
  };
  const customer = {
    email: `commerce-e2e-customer-${suffix}@example.test`,
    id: `commerce-e2e-customer-${suffix}`,
    password,
  };
  const couponId = `commerce-e2e-coupon-${suffix}`;
  const shippingDiscountId = `commerce-e2e-shipping-discount-${suffix}`;
  const pickupPointId = `commerce-e2e-pickup-${suffix}`;
  const couponCode = `PROTECT-${suffix}`;
  const [paymentMethodSnapshot, shippingProviderSnapshot, mainPickup] = await Promise.all([
    readPaymentMethodSnapshot(database),
    readShippingProviderSnapshot(database),
    database.pickupPoint.findFirst({ orderBy: { id: "asc" }, select: { id: true }, where: { isMain: true } }),
  ]);

  await database.$transaction(async (transaction) => {
    await transaction.user.createMany({
      data: [
        {
          email: admin.email,
          firstName: "Commerce",
          id: admin.id,
          lastName: "Admin",
          passwordHash: await bcrypt.hash(admin.password, 4),
          role: Role.ADMIN,
        },
        {
          email: customer.email,
          firstName: "Commerce",
          id: customer.id,
          lastName: "Customer",
          passwordHash: await bcrypt.hash(customer.password, 4),
          role: Role.CUSTOMER,
        },
      ],
    });
    await transaction.coupon.create({
      data: {
        canCombineWithPromotions: false,
        code: couponCode,
        customerLimitType: CouponCustomerLimitType.UNLIMITED,
        dateLimitType: CouponDateLimitType.UNLIMITED,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: "10.00",
        id: couponId,
        includeShippingCost: false,
        maxDiscountType: CouponMaxDiscountType.NONE,
        minimumCartAmount: "0.00",
        status: CouponStatus.ACTIVE,
        targetType: CouponTargetType.ALL_STORE,
        totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
      },
    });
    await transaction.shippingDiscount.create({
      data: {
        canCombineWithPromotions: false,
        id: shippingDiscountId,
        minimumCartAmount: "0.00",
        onlyCheapestShippingMethod: false,
        shippingMethodIds: ["andreani:envío-a-domicilio"],
        status: CouponStatus.ACTIVE,
        targetType: ShippingDiscountTargetType.ALL_STORE,
        zoneIds: [],
        zoneTargetType: ShippingZoneTargetType.ALL,
      },
    });
    await transaction.pickupPoint.create({
      data: {
        city: "Buenos Aires",
        costType: PickupCostType.FREE,
        coverageType: PickupCoverageType.ALL,
        id: pickupPointId,
        isMain: false,
        name: "Commerce e2e pickup",
        number: "123",
        postalCode: "C1000",
        preparationHours: 24,
        province: "Buenos Aires",
        provinces: [],
        schedules: {
          create: {
            closesAt: "18:00",
            dayOfWeek: "monday",
            id: `${pickupPointId}-schedule`,
            opensAt: "09:00",
            sortOrder: 1,
          },
        },
        status: PickupPointStatus.NOT_CONFIGURED,
        street: "Commerce Street",
      },
    });
  });

  return {
    admin,
    couponCode,
    couponId,
    couponIds: [couponId],
    customer,
    mainPickupId: mainPickup?.id,
    paymentMethodSnapshot,
    pickupPointId,
    shippingDiscountId,
    shippingDiscountIds: [shippingDiscountId],
    shippingProviderSnapshot,
    suffix,
  };
}

export async function cleanupFixtures(database: PrismaService, fixtures: FixtureRecords): Promise<void> {
  const cleanupOperations: Array<() => Promise<void>> = [
    () => restorePaymentMethod(database, fixtures.paymentMethodSnapshot),
    () => restoreShippingProvider(database, fixtures.shippingProviderSnapshot),
    () => restoreMainPickup(database, fixtures.mainPickupId),
    async () => {
      await database.coupon.deleteMany({ where: { id: { in: fixtures.couponIds } } });
    },
    async () => {
      await database.shippingDiscount.deleteMany({ where: { id: { in: fixtures.shippingDiscountIds } } });
    },
    async () => {
      await database.pickupPoint.deleteMany({ where: { id: fixtures.pickupPointId } });
    },
    async () => {
      await database.user.deleteMany({ where: { id: { in: [fixtures.admin.id, fixtures.customer.id] } } });
    },
  ];
  const failures: unknown[] = [];

  for (const operation of cleanupOperations) {
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Commerce e2e fixture cleanup failed: ${failures.map(String).join(" | ")}`);
  }
}

export function paymentMethodInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    selectedOptionId: "direct-transfer",
    status: "inactive",
    ...overrides,
  };
}

export function bankTransferInput(suffix: string): BankTransferResponse {
  return {
    alias: `COMMERCE.${suffix.slice(0, 12).toUpperCase()}`,
    bankName: "Banco EntrenAR",
    cbuCvu: "1234567890123456789012",
    cuitCuil: "20-12345678-9",
    holderName: "EntrenAR Commerce",
  };
}

export function shippingProviderInput(costs: readonly number[] = [1, 2, 3, 4, 5]): Record<string, unknown> & { weightRanges: WeightBandResponse[] } {
  return {
    enabledModalities: ["home_delivery", "branch_delivery"],
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
    weightRanges: FIXED_WEIGHT_BANDS.map((range, index) => ({ ...range, cost: costs[index] ?? 1 })),
  };
}

export function pickupPointInput(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    address: {
      city: "Buenos Aires",
      number: "123",
      postalCode: "C1000",
      province: "Buenos Aires",
      street: "Commerce Street",
    },
    costType: "free",
    coverageType: "all",
    isMain: false,
    name: "Commerce pickup point",
    preparationHours: 24,
    provinces: [],
    schedule: [{ day: "monday", from: "09:00", id: `${id}-schedule`, to: "18:00" }],
    status: "active",
    ...overrides,
  };

  if (input["costType"] === "free" && !Object.prototype.hasOwnProperty.call(overrides, "fixedCost")) {
    delete input["fixedCost"];
  }

  return input;
}

export function couponInput(code: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    canCombineWithPromotions: false,
    categoryIds: [],
    code,
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

  if (input["discountType"] === "free_shipping" && !Object.prototype.hasOwnProperty.call(overrides, "discountValue")) {
    delete input["discountValue"];
  }

  return input;
}

export function shippingDiscountInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    canCombineWithPromotions: false,
    categoryIds: [],
    minimumCartAmount: 0,
    onlyCheapestShippingMethod: false,
    shippingMethodIds: ["andreani:envio-a-domicilio"],
    status: "active",
    targetType: "all_store",
    zoneIds: [],
    zoneTargetType: "all",
    ...overrides,
  };
}

async function restorePaymentMethod(database: PrismaService, snapshot: PaymentMethodSnapshot): Promise<void> {
  await database.paymentMethodConfig.update({
    data: {
      acceptedMethods: jsonInput(snapshot.acceptedMethods),
      bankConfig: snapshot.bankConfig === null ? Prisma.DbNull : jsonInput(snapshot.bankConfig),
      description: snapshot.description,
      logoSrc: snapshot.logoSrc,
      name: snapshot.name,
      options: jsonInput(snapshot.options),
      selectedOptionId: snapshot.selectedOptionId,
      status: snapshot.status,
    },
    where: { id: snapshot.id },
  });
}

async function restoreShippingProvider(database: PrismaService, snapshot: ShippingProviderSnapshot): Promise<void> {
  await database.shippingProvider.update({
    data: {
      enabledModalities: jsonInput(snapshot.enabledModalities),
      freeShippingThreshold: snapshot.freeShippingThreshold,
      originApartment: snapshot.originApartment,
      originCity: snapshot.originCity,
      originCuitCuil: snapshot.originCuitCuil,
      originEmail: snapshot.originEmail,
      originFloor: snapshot.originFloor,
      originNumber: snapshot.originNumber,
      originPhone: snapshot.originPhone,
      originPostalCode: snapshot.originPostalCode,
      originProvince: snapshot.originProvince,
      originReference: snapshot.originReference,
      originSenderName: snapshot.originSenderName,
      originStreet: snapshot.originStreet,
      status: snapshot.status,
    },
    where: { id: snapshot.id },
  });
  for (const weightBand of snapshot.weightBands) {
    await database.weightBand.update({
      data: {
        cost: weightBand.cost,
        maxWeightGrams: weightBand.maxWeightGrams,
        minWeightGrams: weightBand.minWeightGrams,
        sortOrder: weightBand.sortOrder,
      },
      where: { id: weightBand.id },
    });
  }
}

async function restoreMainPickup(database: PrismaService, mainPickupId: string | undefined): Promise<void> {
  await database.pickupPoint.updateMany({ data: { isMain: false }, where: { isMain: true } });
  if (mainPickupId) {
    await database.pickupPoint.update({ data: { isMain: true }, where: { id: mainPickupId } });
  }
}

async function readPaymentMethodSnapshot(database: PrismaService) {
  return database.paymentMethodConfig.findUniqueOrThrow({ where: { id: "bank-transfer" } });
}

async function readShippingProviderSnapshot(database: PrismaService) {
  return database.shippingProvider.findUniqueOrThrow({ include: { weightBands: true }, where: { id: "andreani" } });
}

function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export interface FixtureUser {
  email: string;
  id: string;
  password: string;
}

export interface FixtureRecords {
  admin: FixtureUser;
  couponCode: string;
  couponId: string;
  couponIds: string[];
  customer: FixtureUser;
  mainPickupId?: string;
  paymentMethodSnapshot: PaymentMethodSnapshot;
  pickupPointId: string;
  shippingDiscountId: string;
  shippingDiscountIds: string[];
  shippingProviderSnapshot: ShippingProviderSnapshot;
  suffix: string;
}

export interface CommerceFixtures extends FixtureRecords {
  adminToken: string;
  customerToken: string;
}

export type PaymentMethodSnapshot = Awaited<ReturnType<typeof readPaymentMethodSnapshot>>;
export type ShippingProviderSnapshot = Awaited<ReturnType<typeof readShippingProviderSnapshot>>;
