import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponHistoryAction,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  PaymentMethodStatus,
  PickupCostType,
  PickupCoverageType,
  PickupPointStatus,
  Role,
  ShippingDiscountTargetType,
  ShippingProviderStatus,
  ShippingZoneTargetType,
} from "../../generated/prisma/enums";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  couponSelect,
  paymentMethodSelect,
  pickupPointSelect,
  shippingDiscountSelect,
  shippingProviderSelect,
  type CouponRecord,
  type PaymentMethodRecord,
  type PickupPointRecord,
  type ShippingDiscountRecord,
  type ShippingProviderRecord,
} from "./commerce.mapper";

export type TransactionClient = Prisma.TransactionClient;

export interface PaymentMethodUpdateRecord {
  bankConfig?: Prisma.InputJsonValue | null;
  selectedOptionId?: string | null;
  status: PaymentMethodStatus;
}

export interface ShippingProviderOriginRecord {
  apartment?: string | null;
  city?: string | null;
  cuitCuil?: string | null;
  email?: string | null;
  floor?: string | null;
  number?: string | null;
  phone?: string | null;
  province?: string | null;
  reference?: string | null;
  postalCode?: string | null;
  senderName?: string | null;
  street?: string | null;
}

export interface WeightBandCostRecord {
  cost: number;
  id: string;
}

export interface ShippingProviderUpdateRecord {
  enabledModalities: Prisma.InputJsonValue;
  freeShippingThreshold: number | null;
  origin: ShippingProviderOriginRecord;
  status: ShippingProviderStatus;
  weightBands: readonly WeightBandCostRecord[];
}

export interface PickupScheduleRecord {
  closesAt: string;
  dayOfWeek: string;
  id?: string;
  opensAt: string;
  sortOrder: number;
}

export interface PickupPointUpdateRecord {
  city: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  costType: PickupCostType;
  coverageType: PickupCoverageType;
  fixedCost: number | null;
  isMain: boolean;
  name: string;
  number: string | null;
  postalCode: string | null;
  preparationHours: number;
  provinces: Prisma.InputJsonValue;
  province: string | null;
  schedules: readonly PickupScheduleRecord[];
  status: PickupPointStatus;
  street: string | null;
}

export interface CouponMutationRecord {
  canCombineWithPromotions: boolean;
  categoryIds: readonly string[];
  code: string;
  customerLimitType: CouponCustomerLimitType;
  customerUsageLimit: number | null;
  dateLimitType: CouponDateLimitType;
  discountType: CouponDiscountType;
  discountValue: number | null;
  endDate: Date | null;
  includeShippingCost: boolean;
  maxDiscountAmount: number | null;
  maxDiscountType: CouponMaxDiscountType;
  minimumCartAmount: number;
  productIds: readonly string[];
  startDate: Date | null;
  status: CouponStatus;
  targetType: CouponTargetType;
  totalUsageLimit: number | null;
  totalUsageLimitType: CouponUsageLimitType;
}

export interface CouponActorRecord {
  email: string;
  firstName: string | null;
  id: string;
  lastName: string | null;
}

export interface CouponHistoryRecord {
  action: CouponHistoryAction;
  actorId: string;
  actorName: string;
  couponId: string;
}

export interface ShippingDiscountMutationRecord {
  canCombineWithPromotions: boolean;
  categoryIds: readonly string[];
  minimumCartAmount: number;
  onlyCheapestShippingMethod: boolean;
  shippingMethodIds: readonly string[];
  status: CouponStatus;
  targetType: ShippingDiscountTargetType;
  zoneIds: readonly string[];
  zoneTargetType: ShippingZoneTargetType;
}

@Injectable()
export class CommerceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async paymentMethods(): Promise<PaymentMethodRecord[]> {
    return this.prisma.paymentMethodConfig.findMany({
      orderBy: { id: "asc" },
      select: paymentMethodSelect,
    });
  }

  async paymentMethodById(transaction: TransactionClient, id: string): Promise<PaymentMethodRecord | null> {
    return transaction.paymentMethodConfig.findUnique({ select: paymentMethodSelect, where: { id } });
  }

  async updatePaymentMethod(
    transaction: TransactionClient,
    id: string,
    input: PaymentMethodUpdateRecord,
  ): Promise<PaymentMethodRecord> {
    const data: Prisma.PaymentMethodConfigUpdateInput = {
      selectedOptionId: input.selectedOptionId,
      status: input.status,
    };

    if (input.bankConfig !== undefined) {
      data.bankConfig = input.bankConfig === null ? Prisma.DbNull : input.bankConfig;
    }

    return transaction.paymentMethodConfig.update({ data, select: paymentMethodSelect, where: { id } });
  }

  async shippingProviders(): Promise<ShippingProviderRecord[]> {
    return this.prisma.shippingProvider.findMany({
      orderBy: { id: "asc" },
      select: shippingProviderSelect,
    });
  }

  async shippingProviderById(transaction: TransactionClient, id: string): Promise<ShippingProviderRecord | null> {
    return transaction.shippingProvider.findUnique({ select: shippingProviderSelect, where: { id } });
  }

  async updateShippingProvider(
    transaction: TransactionClient,
    id: string,
    input: ShippingProviderUpdateRecord,
  ): Promise<ShippingProviderRecord> {
    await transaction.shippingProvider.update({
      data: {
        enabledModalities: input.enabledModalities,
        freeShippingThreshold: input.freeShippingThreshold,
        originApartment: input.origin.apartment,
        originCity: input.origin.city,
        originCuitCuil: input.origin.cuitCuil,
        originEmail: input.origin.email,
        originFloor: input.origin.floor,
        originNumber: input.origin.number,
        originPhone: input.origin.phone,
        originPostalCode: input.origin.postalCode,
        originProvince: input.origin.province,
        originReference: input.origin.reference,
        originSenderName: input.origin.senderName,
        originStreet: input.origin.street,
        status: input.status,
      },
      where: { id },
    });

    for (const weightBand of input.weightBands) {
      await transaction.weightBand.update({
        data: { cost: weightBand.cost },
        where: { id: weightBand.id, shippingProviderId: id },
      });
    }

    const updated = await this.shippingProviderById(transaction, id);
    if (!updated) throw new Error("Updated shipping provider was not found.");

    return updated;
  }

  async pickupPoints(): Promise<PickupPointRecord[]> {
    return this.prisma.pickupPoint.findMany({
      orderBy: [{ isMain: "desc" }, { id: "asc" }],
      select: pickupPointSelect,
    });
  }

  async pickupPointById(transaction: TransactionClient, id: string): Promise<PickupPointRecord | null> {
    return transaction.pickupPoint.findUnique({ select: pickupPointSelect, where: { id } });
  }

  async lockPickupPoints(transaction: TransactionClient): Promise<void> {
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "PickupPoint" ORDER BY "id" FOR UPDATE`);
  }

  async clearMainPickupPoints(transaction: TransactionClient, exceptId: string): Promise<void> {
    await transaction.pickupPoint.updateMany({
      data: { isMain: false },
      where: { id: { not: exceptId }, isMain: true },
    });
  }

  async updatePickupPoint(
    transaction: TransactionClient,
    id: string,
    input: PickupPointUpdateRecord,
  ): Promise<PickupPointRecord> {
    await transaction.pickupPoint.update({
      data: {
        city: input.city,
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        costType: input.costType,
        coverageType: input.coverageType,
        fixedCost: input.fixedCost,
        isMain: input.isMain,
        name: input.name,
        number: input.number,
        postalCode: input.postalCode,
        preparationHours: input.preparationHours,
        provinces: input.provinces,
        province: input.province,
        status: input.status,
        street: input.street,
      },
      where: { id },
    });

    await transaction.pickupPointSchedule.deleteMany({ where: { pickupPointId: id } });
    if (input.schedules.length > 0) {
      await transaction.pickupPointSchedule.createMany({
        data: input.schedules.map((schedule) => ({
          closesAt: schedule.closesAt,
          dayOfWeek: schedule.dayOfWeek,
          ...(schedule.id ? { id: schedule.id } : {}),
          opensAt: schedule.opensAt,
          pickupPointId: id,
          sortOrder: schedule.sortOrder,
        })),
      });
    }

    const updated = await this.pickupPointById(transaction, id);
    if (!updated) throw new Error("Updated pickup point was not found.");

    return updated;
  }

  async categoryIdsExist(transaction: TransactionClient, ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    return (await transaction.category.count({ where: { id: { in: [...ids] } } })) === ids.length;
  }

  async productIdsExist(transaction: TransactionClient, ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    return (await transaction.product.count({ where: { id: { in: [...ids] } } })) === ids.length;
  }

  async couponActorById(transaction: TransactionClient, id: string): Promise<CouponActorRecord | null> {
    return transaction.user.findFirst({
      select: { email: true, firstName: true, id: true, lastName: true },
      where: { id, role: Role.ADMIN },
    });
  }

  async coupons(): Promise<CouponRecord[]> {
    return this.prisma.coupon.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: couponSelect,
      where: { deletedAt: null },
    });
  }

  async couponById(transaction: TransactionClient, id: string): Promise<CouponRecord | null> {
    return transaction.coupon.findFirst({ select: couponSelect, where: { deletedAt: null, id } });
  }

  async createCoupon(transaction: TransactionClient, input: CouponMutationRecord): Promise<CouponRecord> {
    const coupon = await transaction.coupon.create({ data: couponData(input) });
    await this.replaceCouponTargets(transaction, coupon.id, input.categoryIds, input.productIds);

    const created = await this.couponById(transaction, coupon.id);
    if (!created) throw new Error("Created coupon was not found.");

    return created;
  }

  async updateCoupon(transaction: TransactionClient, id: string, input: CouponMutationRecord): Promise<CouponRecord> {
    await transaction.coupon.update({ data: couponData(input), where: { id, deletedAt: null } });
    await this.replaceCouponTargets(transaction, id, input.categoryIds, input.productIds);

    const updated = await this.couponById(transaction, id);
    if (!updated) throw new Error("Updated coupon was not found.");

    return updated;
  }

  async softDeleteCoupon(transaction: TransactionClient, id: string): Promise<boolean> {
    const result = await transaction.coupon.updateMany({
      data: { deletedAt: new Date(), status: CouponStatus.INACTIVE },
      where: { deletedAt: null, id },
    });

    return result.count === 1;
  }

  async createCouponHistory(transaction: TransactionClient, input: CouponHistoryRecord): Promise<void> {
    await transaction.couponHistory.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        actorName: input.actorName,
        couponId: input.couponId,
      },
    });
  }

  async shippingDiscounts(): Promise<ShippingDiscountRecord[]> {
    return this.prisma.shippingDiscount.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: shippingDiscountSelect,
      where: { deletedAt: null },
    });
  }

  async shippingDiscountById(transaction: TransactionClient, id: string): Promise<ShippingDiscountRecord | null> {
    return transaction.shippingDiscount.findFirst({ select: shippingDiscountSelect, where: { deletedAt: null, id } });
  }

  async createShippingDiscount(transaction: TransactionClient, input: ShippingDiscountMutationRecord): Promise<ShippingDiscountRecord> {
    const discount = await transaction.shippingDiscount.create({ data: shippingDiscountData(input) });
    await this.replaceShippingDiscountCategories(transaction, discount.id, input.categoryIds);

    const created = await this.shippingDiscountById(transaction, discount.id);
    if (!created) throw new Error("Created shipping discount was not found.");

    return created;
  }

  async updateShippingDiscount(
    transaction: TransactionClient,
    id: string,
    input: ShippingDiscountMutationRecord,
  ): Promise<ShippingDiscountRecord> {
    await transaction.shippingDiscount.update({ data: shippingDiscountData(input), where: { deletedAt: null, id } });
    await this.replaceShippingDiscountCategories(transaction, id, input.categoryIds);

    const updated = await this.shippingDiscountById(transaction, id);
    if (!updated) throw new Error("Updated shipping discount was not found.");

    return updated;
  }

  async softDeleteShippingDiscount(transaction: TransactionClient, id: string): Promise<boolean> {
    const result = await transaction.shippingDiscount.updateMany({
      data: { deletedAt: new Date(), status: CouponStatus.INACTIVE },
      where: { deletedAt: null, id },
    });

    return result.count === 1;
  }

  private async replaceCouponTargets(
    transaction: TransactionClient,
    couponId: string,
    categoryIds: readonly string[],
    productIds: readonly string[],
  ): Promise<void> {
    await transaction.couponCategory.deleteMany({ where: { couponId } });
    await transaction.couponProduct.deleteMany({ where: { couponId } });

    if (categoryIds.length > 0) {
      await transaction.couponCategory.createMany({ data: categoryIds.map((categoryId) => ({ categoryId, couponId })) });
    }
    if (productIds.length > 0) {
      await transaction.couponProduct.createMany({ data: productIds.map((productId) => ({ couponId, productId })) });
    }
  }

  private async replaceShippingDiscountCategories(
    transaction: TransactionClient,
    shippingDiscountId: string,
    categoryIds: readonly string[],
  ): Promise<void> {
    await transaction.shippingDiscountCategory.deleteMany({ where: { shippingDiscountId } });
    if (categoryIds.length > 0) {
      await transaction.shippingDiscountCategory.createMany({
        data: categoryIds.map((categoryId) => ({ categoryId, shippingDiscountId })),
      });
    }
  }
}

function couponData(input: CouponMutationRecord): Prisma.CouponUncheckedCreateInput {
  return {
    canCombineWithPromotions: input.canCombineWithPromotions,
    code: input.code,
    customerLimitType: input.customerLimitType,
    customerUsageLimit: input.customerUsageLimit,
    dateLimitType: input.dateLimitType,
    discountType: input.discountType,
    discountValue: input.discountValue,
    endDate: input.endDate,
    includeShippingCost: input.includeShippingCost,
    maxDiscountAmount: input.maxDiscountAmount,
    maxDiscountType: input.maxDiscountType,
    minimumCartAmount: input.minimumCartAmount,
    startDate: input.startDate,
    status: input.status,
    targetType: input.targetType,
    totalUsageLimit: input.totalUsageLimit,
    totalUsageLimitType: input.totalUsageLimitType,
  };
}

function shippingDiscountData(input: ShippingDiscountMutationRecord): Prisma.ShippingDiscountUncheckedCreateInput {
  return {
    canCombineWithPromotions: input.canCombineWithPromotions,
    minimumCartAmount: input.minimumCartAmount,
    onlyCheapestShippingMethod: input.onlyCheapestShippingMethod,
    shippingMethodIds: [...input.shippingMethodIds],
    status: input.status,
    targetType: input.targetType,
    zoneIds: [...input.zoneIds],
    zoneTargetType: input.zoneTargetType,
  };
}

export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
