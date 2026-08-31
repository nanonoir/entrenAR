import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { stderr } from "node:process";
import { promisify } from "node:util";

import { HttpException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  Role,
  ShippingProviderStatus,
} from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { CommerceRepository } from "../src/modules/commerce/commerce.repository";
import { FIXED_WEIGHT_BANDS } from "../src/modules/commerce/commerce.constants";
import { DiscountService } from "../src/modules/commerce/services/discount.service";
import { ShippingService } from "../src/modules/commerce/services/shipping.service";
import { couponSchema } from "../src/modules/commerce/schemas/discount.schemas";
import { shippingProviderUpdateSchema, pickupPointUpdateSchema, type PickupPointUpdateInput, type ShippingProviderUpdateInput } from "../src/modules/commerce/schemas/shipping.schemas";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env["DATABASE_URL"];
const SEED_ADMIN_EMAIL = "commerce-seed-admin@example.test";
const SEED_ADMIN_PASSWORD = "commerce-seed-password-123";

describe("commerce persistence integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const repository = new CommerceRepository(prisma as unknown as PrismaService);
  const shipping = new ShippingService(repository);
  const discounts = new DiscountService(repository);
  let seedState: CommerceSeedState | undefined;
  let fixtures: CommerceFixtures | undefined;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for commerce integration tests.");
    }

    await runSeed();
    await runSeed();
    seedState = await readSeedState(prisma);
    fixtures = await createFixtures(prisma);
  });

  afterAll(async () => {
    try {
      if (fixtures) await deleteFixtures(prisma, fixtures);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("keeps the commerce seed repeatable with the expected records and no duplicates", () => {
    const state = requireSeedState(seedState);

    expect(state).toEqual({
      paymentMethodCount: 4,
      paymentMethodIds: ["bank-transfer", "mercado-pago", "payway", "stripe"],
      pickupPointCount: 1,
      pickupPointIds: ["retiro-principal"],
      pickupPointMainCount: 1,
      shippingProviderCount: 2,
      shippingProviderIds: ["andreani", "correo-argentino"],
      weightBandCount: 10,
      weightBandCounts: [5, 5],
      openEndedWeightBandCount: 2,
    });
  });

  it("persists an open-ended band and rejects immutable-boundary changes without partial writes", async () => {
    const fixture = requireFixtures(fixtures);
    const input = shippingProviderUpdateSchema.parse({
      ...validProviderInput(),
      weightRanges: FIXED_WEIGHT_BANDS.map((range, index) => ({ ...range, cost: index + 20 })),
    });

    await expect(shipping.updateProvider(fixture.providerId, input)).resolves.toEqual(expect.objectContaining({
      id: fixture.providerId,
      weightRanges: expect.arrayContaining([expect.objectContaining({ maxGrams: null, minGrams: 10_000 })]),
    }));

    const openEnded = await prisma.weightBand.findFirstOrThrow({ where: { maxWeightGrams: null, shippingProviderId: fixture.providerId } });
    expect(openEnded.cost.toString()).toBe("24");
    expect(openEnded.maxWeightGrams).toBeNull();

    const invalid = {
      ...input,
      weightRanges: input.weightRanges.map((range, index) => index === 0 ? { ...range, maxGrams: 2_000 } : range),
    } as unknown as ShippingProviderUpdateInput;
    await expectCode(shipping.updateProvider(fixture.providerId, invalid), "INVALID_WEIGHT_RANGE");

    const unchanged = await prisma.weightBand.findUniqueOrThrow({ where: { id: openEnded.id } });
    expect(unchanged.cost.toString()).toBe("24");
    expect(unchanged.maxWeightGrams).toBeNull();
  });

  it("rejects a fixed pickup cost before persistence", async () => {
    const fixture = requireFixtures(fixtures);
    const input = {
      ...validPickupInput("pickup-a"),
      costType: "fixed",
    } as unknown as PickupPointUpdateInput;

    await expectCode(shipping.updatePickupPoint(fixture.pickupAId, input), "INVALID_PICKUP_CONFIGURATION");
    await expect(prisma.pickupPoint.findUniqueOrThrow({ where: { id: fixture.pickupAId } })).resolves.toEqual(
      expect.objectContaining({ fixedCost: null, isMain: false, status: "NOT_CONFIGURED" }),
    );
  });

  it("keeps coupon create and update transaction reads free of pg client-query deprecations", async () => {
    const fixture = requireFixtures(fixtures);
    const code = `sequential-${fixture.suffix}`;
    const { created, updated } = await expectNoClientQueryDeprecation(async () => {
      const created = await discounts.createCoupon(couponSchema.parse(validCoupon(code, {
        categoryIds: ["cat-training", "cat-supplements"],
        targetType: "categories",
      })), fixture.adminId);
      fixture.couponIds.push(created.id);
      const updated = await discounts.updateCoupon(
        created.id,
        couponSchema.parse(validCoupon(code, {
          discountValue: 20,
          productIds: ["p-whey-pro", "p-creatine"],
          targetType: "products",
        })),
        fixture.adminId,
      );

      return { created, updated };
    });

    expect(created).toEqual(expect.objectContaining({
      categoryIds: ["cat-supplements", "cat-training"],
      code: code.toUpperCase(),
      history: [expect.objectContaining({ action: "created" })],
      productIds: [],
    }));
    expect(updated).toEqual(expect.objectContaining({
      categoryIds: [],
      discountValue: 20,
      history: expect.arrayContaining([expect.objectContaining({ action: "updated" })]),
      id: created.id,
      productIds: ["p-creatine", "p-whey-pro"],
    }));
  });

  it("enforces active coupon-code uniqueness at PostgreSQL level and allows reuse after soft deletion", async () => {
    const fixture = requireFixtures(fixtures);
    const reusableInput = couponSchema.parse(validCoupon(`reuse-${fixture.suffix}`));
    const deleted = await discounts.createCoupon(reusableInput, fixture.adminId);
    fixture.couponIds.push(deleted.id);

    const [partialIndex] = await prisma.$queryRaw<Array<{ indexName: string; predicate: string | null }>>(Prisma.sql`
      SELECT indexrelid::regclass::text AS "indexName", pg_get_expr(indpred, indrelid) AS predicate
      FROM pg_index
      WHERE indexrelid = '"Coupon_code_active_key"'::regclass
    `);
    expect(partialIndex).toEqual(expect.objectContaining({ indexName: "\"Coupon_code_active_key\"" }));
    expect(partialIndex?.predicate).toContain('"deletedAt" IS NULL');

    await expect(prisma.coupon.create({
      data: {
        canCombineWithPromotions: false,
        code: deleted.code,
        customerLimitType: CouponCustomerLimitType.UNLIMITED,
        dateLimitType: CouponDateLimitType.UNLIMITED,
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: "10.00",
        id: `commerce-duplicate-coupon-${fixture.suffix}`,
        includeShippingCost: false,
        maxDiscountType: CouponMaxDiscountType.NONE,
        minimumCartAmount: "0.00",
        status: CouponStatus.ACTIVE,
        targetType: CouponTargetType.ALL_STORE,
        totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
      },
    })).rejects.toMatchObject({ code: "P2002" });

    await expectCode(discounts.createCoupon(reusableInput, fixture.adminId), "COUPON_CODE_ALREADY_EXISTS");
    await expect(discounts.deleteCoupon(deleted.id)).resolves.toEqual({ ok: true });

    const reused = await discounts.createCoupon(reusableInput, fixture.adminId);
    fixture.couponIds.push(reused.id);
    expect(reused.id).not.toBe(deleted.id);

    await expect(prisma.coupon.findUniqueOrThrow({ where: { id: deleted.id } })).resolves.toEqual(expect.objectContaining({ deletedAt: expect.any(Date) }));
    await expect(prisma.coupon.count({ where: { code: reusableInput.code, deletedAt: null } })).resolves.toBe(1);
  });

  it("stores relational coupon history with server-derived actor snapshots and safe projections", async () => {
    const fixture = requireFixtures(fixtures);
    const code = `history-${fixture.suffix}`;
    const normalizedCode = code.toUpperCase();
    const created = await expectNoClientQueryDeprecation(async () => {
      const created = await discounts.createCoupon(couponSchema.parse(validCoupon(code)), fixture.adminId);
      fixture.couponIds.push(created.id);

      await prisma.user.update({
        data: { firstName: "Renamed", lastName: "Administrator" },
        where: { id: fixture.adminId },
      });
      await discounts.updateCoupon(
        created.id,
        couponSchema.parse(validCoupon(code, { discountValue: 20, status: "inactive" })),
        fixture.adminId,
      );

      return created;
    });

    const history = await prisma.couponHistory.findMany({
      include: {
        actor: { select: { email: true, id: true, role: true } },
        coupon: { select: { code: true, id: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { couponId: created.id },
    });
    expect(history).toHaveLength(2);
    const createdHistory = history.find((entry) => entry.action === "CREATED");
    const deactivatedHistory = history.find((entry) => entry.action === "DEACTIVATED");
    expect(createdHistory).toEqual(expect.objectContaining({
      action: "CREATED",
      actorId: fixture.adminId,
      actorName: "Commerce Admin",
      couponId: created.id,
      coupon: { code: normalizedCode, id: created.id },
      actor: { email: fixture.adminEmail, id: fixture.adminId, role: Role.ADMIN },
    }));
    expect(deactivatedHistory).toEqual(expect.objectContaining({
      action: "DEACTIVATED",
      actorId: fixture.adminId,
      actorName: "Renamed Administrator",
    }));

    const projection = (await discounts.listCoupons()).find((coupon) => coupon.id === created.id);
    expect(projection).toEqual(expect.objectContaining({
      code: normalizedCode,
      history: expect.arrayContaining([
        expect.objectContaining({ action: "created", userName: "Commerce Admin" }),
        expect.objectContaining({ action: "deactivated", userName: "Renamed Administrator" }),
      ]),
    }));
    expect(projection).not.toHaveProperty("deletedAt");
    expect(projection?.history[0]).not.toHaveProperty("actorId");
    expect(projection?.history[0]).not.toHaveProperty("couponId");
    expect(projection?.history[0]).not.toHaveProperty("actor");

    const customerCouponCode = `customer-${fixture.suffix}`;
    await expectCode(
      discounts.createCoupon(couponSchema.parse(validCoupon(customerCouponCode)), fixture.customerId),
      "NOT_FOUND",
    );
    await expect(prisma.coupon.count({ where: { code: customerCouponCode } })).resolves.toBe(0);
    await expect(prisma.couponHistory.count({ where: { couponId: created.id } })).resolves.toBe(2);
  });

  it("serializes concurrent main pickup updates to exactly one main point", async () => {
    const fixture = requireFixtures(fixtures);
    const first = pickupPointUpdateSchema.parse({ ...validPickupInput(fixture.pickupAId), isMain: true });
    const second = pickupPointUpdateSchema.parse({ ...validPickupInput(fixture.pickupBId), isMain: true });

    const results = await Promise.all([
      shipping.updatePickupPoint(fixture.pickupAId, first),
      shipping.updatePickupPoint(fixture.pickupBId, second),
    ]);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.isMain)).toEqual([true, true]);

    const mainPoints = await prisma.pickupPoint.findMany({ orderBy: { id: "asc" }, select: { id: true }, where: { isMain: true } });
    expect(mainPoints).toHaveLength(1);
    expect([fixture.pickupAId, fixture.pickupBId]).toContain(mainPoints[0]?.id);
    if (fixture.existingMainId) {
      await expect(prisma.pickupPoint.findUniqueOrThrow({ where: { id: fixture.existingMainId } })).resolves.toEqual(
        expect.objectContaining({ isMain: false }),
      );
    }
  });
});

async function runSeed(): Promise<void> {
  const { stderr } = await execFileAsync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_EMAIL: SEED_ADMIN_EMAIL,
      ADMIN_PASSWORD: SEED_ADMIN_PASSWORD,
    },
    timeout: 60_000,
  });

  if (stderr) throw new Error(`Commerce seed wrote to stderr: ${stderr}`);
}

async function readSeedState(prisma: PrismaClient) {
  const [paymentMethods, shippingProviders, pickupPoints] = await Promise.all([
    prisma.paymentMethodConfig.findMany({ orderBy: { id: "asc" }, select: { id: true } }),
    prisma.shippingProvider.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        weightBands: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { maxWeightGrams: true },
        },
      },
    }),
    prisma.pickupPoint.findMany({ orderBy: { id: "asc" }, select: { id: true, isMain: true } }),
  ]);
  const weightBands = shippingProviders.flatMap((provider) => provider.weightBands);

  return {
    openEndedWeightBandCount: weightBands.filter((band) => band.maxWeightGrams === null).length,
    paymentMethodCount: paymentMethods.length,
    paymentMethodIds: paymentMethods.map((paymentMethod) => paymentMethod.id),
    pickupPointCount: pickupPoints.length,
    pickupPointIds: pickupPoints.map((pickupPoint) => pickupPoint.id),
    pickupPointMainCount: pickupPoints.filter((pickupPoint) => pickupPoint.isMain).length,
    shippingProviderCount: shippingProviders.length,
    shippingProviderIds: shippingProviders.map((provider) => provider.id),
    weightBandCount: weightBands.length,
    weightBandCounts: shippingProviders.map((provider) => provider.weightBands.length),
  };
}

async function createFixtures(prisma: PrismaClient): Promise<CommerceFixtures> {
  const suffix = randomUUID().replaceAll("-", "");
  const adminEmail = `commerce-admin-${suffix}@example.test`;
  const adminId = `commerce-admin-${suffix}`;
  const customerId = `commerce-customer-${suffix}`;
  const providerId = "andreani";
  const pickupAId = `commerce-pickup-a-${suffix}`;
  const pickupBId = `commerce-pickup-b-${suffix}`;
  const existingMain = await prisma.pickupPoint.findFirst({ select: { id: true }, where: { isMain: true } });
  const existingProvider = await prisma.shippingProvider.findUnique({ include: { weightBands: true }, where: { id: providerId } });

  if (existingProvider && existingProvider.weightBands.length !== FIXED_WEIGHT_BANDS.length) {
    throw new Error("The commerce integration harness requires seeded fixed weight bands.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.user.createMany({
      data: [
        {
          email: adminEmail,
          firstName: "Commerce",
          id: adminId,
          lastName: "Admin",
          passwordHash: "integration-fixture",
          role: Role.ADMIN,
        },
        {
          email: `commerce-customer-${suffix}@example.test`,
          id: customerId,
          passwordHash: "integration-fixture",
          role: Role.CUSTOMER,
        },
      ],
    });
    if (!existingProvider) {
      await transaction.shippingProvider.create({
        data: {
          enabledModalities: [],
          id: providerId,
          name: "Commerce integration provider",
          status: ShippingProviderStatus.NOT_CONFIGURED,
        },
      });
      await transaction.weightBand.createMany({
        data: FIXED_WEIGHT_BANDS.map((range, index) => ({
          cost: index + 1,
          id: `${providerId}-${range.id}`,
          maxWeightGrams: range.maxGrams,
          minWeightGrams: range.minGrams,
          shippingProviderId: providerId,
          sortOrder: index + 1,
        })),
      });
    }
    await transaction.pickupPoint.createMany({
      data: [pickupAId, pickupBId].map((id) => ({
        id,
        isMain: false,
        name: `Commerce ${id}`,
        status: "NOT_CONFIGURED" as const,
      })),
    });
  });

  return {
    adminEmail,
    adminId,
    couponIds: [],
    customerId,
    existingMainId: existingMain?.id,
    pickupAId,
    pickupBId,
    providerId,
    providerWasCreated: !existingProvider,
    providerSnapshot: existingProvider ?? undefined,
    suffix,
  };
}

async function deleteFixtures(prisma: PrismaClient, fixtures: CommerceFixtures): Promise<void> {
  await prisma.coupon.deleteMany({ where: { id: { in: fixtures.couponIds } } });
  await prisma.pickupPoint.deleteMany({ where: { id: { in: [fixtures.pickupAId, fixtures.pickupBId] } } });
  if (fixtures.providerWasCreated) {
    await prisma.shippingProvider.delete({ where: { id: fixtures.providerId } });
  } else if (fixtures.providerSnapshot) {
    await prisma.shippingProvider.update({
      data: {
        enabledModalities: jsonInput(fixtures.providerSnapshot.enabledModalities),
        freeShippingThreshold: fixtures.providerSnapshot.freeShippingThreshold,
        originApartment: fixtures.providerSnapshot.originApartment,
        originCity: fixtures.providerSnapshot.originCity,
        originCuitCuil: fixtures.providerSnapshot.originCuitCuil,
        originEmail: fixtures.providerSnapshot.originEmail,
        originFloor: fixtures.providerSnapshot.originFloor,
        originNumber: fixtures.providerSnapshot.originNumber,
        originPhone: fixtures.providerSnapshot.originPhone,
        originPostalCode: fixtures.providerSnapshot.originPostalCode,
        originProvince: fixtures.providerSnapshot.originProvince,
        originReference: fixtures.providerSnapshot.originReference,
        originSenderName: fixtures.providerSnapshot.originSenderName,
        originStreet: fixtures.providerSnapshot.originStreet,
        status: fixtures.providerSnapshot.status,
      },
      where: { id: fixtures.providerId },
    });
    for (const weightBand of fixtures.providerSnapshot.weightBands) {
      await prisma.weightBand.update({ data: { cost: weightBand.cost }, where: { id: weightBand.id } });
    }
  }
  await prisma.user.deleteMany({ where: { id: { in: [fixtures.adminId, fixtures.customerId] } } });

  if (fixtures.existingMainId) {
    await prisma.pickupPoint.updateMany({ data: { isMain: false }, where: { isMain: true } });
    await prisma.pickupPoint.update({ data: { isMain: true }, where: { id: fixtures.existingMainId } });
  }
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
    weightRanges: FIXED_WEIGHT_BANDS.map((range, index) => ({ ...range, cost: index + 1 })),
  } as const;
}

function validPickupInput(id: string) {
  return {
    address: { city: "Buenos Aires", number: "123", postalCode: "C1000", province: "Buenos Aires", street: "Main Street" },
    costType: "free",
    coverageType: "all",
    isMain: false,
    name: "Commerce Pickup Point",
    preparationHours: 24,
    provinces: [],
    schedule: [{ day: "monday", from: "09:00", id: `${id}-schedule`, to: "18:00" }],
    status: "active",
  } as const;
}

function validCoupon(code: string, overrides: Record<string, unknown> = {}) {
  return {
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
  } as const;
}

function requireFixtures(value: CommerceFixtures | undefined): CommerceFixtures {
  if (!value) throw new Error("Commerce integration fixtures were not initialized.");
  return value;
}

function requireSeedState(value: CommerceSeedState | undefined): CommerceSeedState {
  if (!value) throw new Error("Commerce seed state was not initialized.");
  return value;
}

async function expectCode(operation: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(errorCode(error)).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected ${expectedCode}.`);
}

async function expectNoClientQueryDeprecation<T>(operation: () => Promise<T>): Promise<T> {
  const warningWrite = jest.spyOn(stderr, "write");
  try {
    const result = await operation();
    await flushProcessWarnings();
    expect(warningWrite.mock.calls.filter(([chunk]) => {
      return typeof chunk === "string" && chunk.includes("client.query() when the client is already executing a query");
    })).toEqual([]);
    return result;
  } finally {
    warningWrite.mockRestore();
  }
}

async function flushProcessWarnings(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();

  return typeof response === "object" && response !== null && "code" in response && typeof response.code === "string"
    ? response.code
    : undefined;
}

interface CommerceFixtures {
  adminEmail: string;
  adminId: string;
  couponIds: string[];
  customerId: string;
  existingMainId?: string;
  pickupAId: string;
  pickupBId: string;
  providerId: string;
  providerSnapshot?: CommerceProviderSnapshot;
  providerWasCreated: boolean;
  suffix: string;
}

type CommerceSeedState = Awaited<ReturnType<typeof readSeedState>>;
type CommerceProviderSnapshot = Prisma.ShippingProviderGetPayload<{ include: { weightBands: true } }>;

function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}
