import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../../common/errors/api-error.response";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponHistoryAction,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  ShippingDiscountTargetType,
  ShippingZoneTargetType,
} from "../../../generated/prisma/enums";
import {
  COUPON_CUSTOMER_LIMIT_TYPE,
  COUPON_DATE_LIMIT_TYPE,
  COUPON_DISCOUNT_TYPE,
  COUPON_MAX_DISCOUNT_TYPE,
  COUPON_TARGET_TYPE,
  COUPON_USAGE_LIMIT_TYPE,
  DISCOUNT_STATUS,
  SHIPPING_DISCOUNT_TARGET_TYPE,
  SHIPPING_ZONE_TARGET_TYPE,
  isSupportedShippingMethodId,
  isSupportedShippingZoneId,
  normalizeShippingMethodId,
} from "../commerce.constants";
import { toCouponProjection, toShippingDiscountProjection, type CouponProjection, type ShippingDiscountProjection } from "../commerce.mapper";
import {
  CommerceRepository,
  isPrismaErrorCode,
  type CouponMutationRecord,
  type ShippingDiscountMutationRecord,
} from "../commerce.repository";
import { normalizeCouponCode, type CouponInput, type ShippingDiscountInput } from "../schemas/discount.schemas";

export type CommerceActor = string | { actorId: string } | { userId: string };

@Injectable()
export class DiscountService {
  constructor(private readonly commerceRepository: CommerceRepository) {}

  async listCoupons(): Promise<CouponProjection[]> {
    const records = await this.commerceRepository.coupons();

    return records.map(toCouponProjection);
  }

  async getCoupons(): Promise<CouponProjection[]> {
    return this.listCoupons();
  }

  async createCoupon(input: CouponInput, actor: CommerceActor): Promise<CouponProjection> {
    return this.commerceRepository.transaction(async (transaction) => {
      const actorRecord = await this.requireActor(transaction, actor);
      await this.assertCouponTargets(transaction, input);

      try {
        const coupon = await this.commerceRepository.createCoupon(transaction, this.toCouponRecord(input));
        await this.commerceRepository.createCouponHistory(transaction, {
          action: CouponHistoryAction.CREATED,
          actorId: actorRecord.id,
          actorName: actorRecord.name,
          couponId: coupon.id,
        });

        const withHistory = await this.commerceRepository.couponById(transaction, coupon.id);
        if (!withHistory) throw this.notFound("The created coupon was not found.");
        return toCouponProjection(withHistory);
      } catch (error) {
        this.rethrowCouponConflict(error);
        throw error;
      }
    });
  }

  async create(input: CouponInput, actor: CommerceActor): Promise<CouponProjection> {
    return this.createCoupon(input, actor);
  }

  async updateCoupon(id: string, input: CouponInput, actor: CommerceActor): Promise<CouponProjection> {
    return this.commerceRepository.transaction(async (transaction) => {
      const current = await this.commerceRepository.couponById(transaction, id);
      if (!current) throw this.notFound("The requested coupon was not found.");

      const actorRecord = await this.requireActor(transaction, actor);
      await this.assertCouponTargets(transaction, input);
      const action = this.historyAction(current.status, input.status);

      try {
        await this.commerceRepository.updateCoupon(transaction, id, this.toCouponRecord(input));
        await this.commerceRepository.createCouponHistory(transaction, {
          action,
          actorId: actorRecord.id,
          actorName: actorRecord.name,
          couponId: id,
        });

        const updated = await this.commerceRepository.couponById(transaction, id);
        if (!updated) throw this.notFound("The updated coupon was not found.");
        return toCouponProjection(updated);
      } catch (error) {
        this.rethrowCouponConflict(error);
        throw error;
      }
    });
  }

  async update(id: string, input: CouponInput, actor: CommerceActor): Promise<CouponProjection> {
    return this.updateCoupon(id, input, actor);
  }

  async deleteCoupon(id: string): Promise<{ ok: true }> {
    return this.commerceRepository.transaction(async (transaction) => {
      const current = await this.commerceRepository.couponById(transaction, id);
      if (!current || !await this.commerceRepository.softDeleteCoupon(transaction, id)) {
        throw this.notFound("The requested coupon was not found.");
      }

      return { ok: true };
    });
  }

  async listShippingDiscounts(): Promise<ShippingDiscountProjection[]> {
    const records = await this.commerceRepository.shippingDiscounts();

    return records.map(toShippingDiscountProjection);
  }

  async getShippingDiscounts(): Promise<ShippingDiscountProjection[]> {
    return this.listShippingDiscounts();
  }

  async createShippingDiscount(input: ShippingDiscountInput): Promise<ShippingDiscountProjection> {
    return this.commerceRepository.transaction(async (transaction) => {
      this.assertShippingConfiguration(input);
      await this.assertShippingDiscountCategories(transaction, input);
      const created = await this.commerceRepository.createShippingDiscount(transaction, this.toShippingDiscountRecord(input));

      return toShippingDiscountProjection(created);
    });
  }

  async updateShippingDiscount(id: string, input: ShippingDiscountInput): Promise<ShippingDiscountProjection> {
    return this.commerceRepository.transaction(async (transaction) => {
      if (!await this.commerceRepository.shippingDiscountById(transaction, id)) {
        throw this.notFound("The requested shipping discount was not found.");
      }
      this.assertShippingConfiguration(input);
      await this.assertShippingDiscountCategories(transaction, input);
      const updated = await this.commerceRepository.updateShippingDiscount(transaction, id, this.toShippingDiscountRecord(input));

      return toShippingDiscountProjection(updated);
    });
  }

  async deleteShippingDiscount(id: string): Promise<{ ok: true }> {
    return this.commerceRepository.transaction(async (transaction) => {
      if (!await this.commerceRepository.shippingDiscountById(transaction, id) || !await this.commerceRepository.softDeleteShippingDiscount(transaction, id)) {
        throw this.notFound("The requested shipping discount was not found.");
      }

      return { ok: true };
    });
  }

  private async requireActor(
    transaction: Parameters<CommerceRepository["couponById"]>[0],
    actor: CommerceActor,
  ): Promise<{ id: string; name: string }> {
    const actorId = this.actorId(actor);
    const record = await this.commerceRepository.couponActorById(transaction, actorId);
    if (!record) throw this.notFound("The authenticated administrator was not found.");

    const name = [record.firstName, record.lastName].filter((part): part is string => Boolean(part?.trim())).join(" ");
    return { id: record.id, name: name || record.email };
  }

  private actorId(actor: CommerceActor): string {
    if (typeof actor === "string") return actor;
    if ("actorId" in actor) return actor.actorId;
    return actor.userId;
  }

  private async assertCouponTargets(transaction: Parameters<CommerceRepository["couponById"]>[0], input: CouponInput): Promise<void> {
    if (!await this.commerceRepository.categoryIdsExist(transaction, input.categoryIds)) {
      throw this.notFound("One or more coupon categories were not found.");
    }
    if (!await this.commerceRepository.productIdsExist(transaction, input.productIds)) {
      throw this.notFound("One or more coupon products were not found.");
    }
  }

  private async assertShippingDiscountCategories(
    transaction: Parameters<CommerceRepository["couponById"]>[0],
    input: ShippingDiscountInput,
  ): Promise<void> {
    if (!await this.commerceRepository.categoryIdsExist(transaction, input.categoryIds)) {
      throw this.notFound("One or more shipping-discount categories were not found.");
    }
  }

  private assertShippingMethods(methodIds: readonly string[]): void {
    if (methodIds.some((id) => !isSupportedShippingMethodId(id))) {
      throw new ConflictException({
        code: ERROR_CODE.INVALID_SHIPPING_METHOD,
        message: "One or more shipping methods are not supported.",
        ok: false,
      });
    }

  }

  private assertShippingConfiguration(input: ShippingDiscountInput): void {
    this.assertShippingMethods(input.shippingMethodIds);
    if (input.zoneIds.some((zoneId) => !isSupportedShippingZoneId(zoneId))) {
      throw this.invalidShippingInput();
    }

    if (input.targetType === SHIPPING_DISCOUNT_TARGET_TYPE.CATEGORIES && input.categoryIds.length === 0) {
      throw this.invalidShippingInput();
    }
    if (input.targetType === SHIPPING_DISCOUNT_TARGET_TYPE.ALL_STORE && input.categoryIds.length > 0) {
      throw this.invalidShippingInput();
    }
    if (input.zoneTargetType === SHIPPING_ZONE_TARGET_TYPE.SPECIFIC && input.zoneIds.length === 0) {
      throw this.invalidShippingInput();
    }
    if (input.zoneTargetType === SHIPPING_ZONE_TARGET_TYPE.ALL && input.zoneIds.length > 0) {
      throw this.invalidShippingInput();
    }
  }

  private toCouponRecord(input: CouponInput): CouponMutationRecord {
    return {
      canCombineWithPromotions: input.canCombineWithPromotions,
      categoryIds: input.categoryIds,
      code: normalizeCouponCode(input.code),
      customerLimitType: this.toCouponCustomerLimitType(input.customerLimitType),
      customerUsageLimit: input.customerUsageLimit ?? null,
      dateLimitType: this.toCouponDateLimitType(input.dateLimitType),
      discountType: this.toCouponDiscountType(input.discountType),
      discountValue: input.discountValue ?? null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      includeShippingCost: input.includeShippingCost,
      maxDiscountAmount: input.maxDiscountAmount ?? null,
      maxDiscountType: this.toCouponMaxDiscountType(input.maxDiscountType),
      minimumCartAmount: input.minimumCartAmount,
      productIds: input.productIds,
      startDate: input.startDate ? new Date(input.startDate) : null,
      status: this.toCouponStatus(input.status),
      targetType: this.toCouponTargetType(input.targetType),
      totalUsageLimit: input.totalUsageLimit ?? null,
      totalUsageLimitType: this.toCouponUsageLimitType(input.totalUsageLimitType),
    };
  }

  private toShippingDiscountRecord(input: ShippingDiscountInput): ShippingDiscountMutationRecord {
    return {
      canCombineWithPromotions: input.canCombineWithPromotions,
      categoryIds: input.categoryIds,
      minimumCartAmount: input.minimumCartAmount,
      onlyCheapestShippingMethod: input.onlyCheapestShippingMethod,
      shippingMethodIds: input.shippingMethodIds.map(normalizeShippingMethodId),
      status: this.toCouponStatus(input.status),
      targetType: input.targetType === SHIPPING_DISCOUNT_TARGET_TYPE.CATEGORIES
        ? ShippingDiscountTargetType.CATEGORIES
        : ShippingDiscountTargetType.ALL_STORE,
      zoneIds: input.zoneIds,
      zoneTargetType: input.zoneTargetType === SHIPPING_ZONE_TARGET_TYPE.SPECIFIC
        ? ShippingZoneTargetType.SPECIFIC
        : ShippingZoneTargetType.ALL,
    };
  }

  private historyAction(current: CouponStatus, next: CouponInput["status"]): CouponHistoryAction {
    if (current === CouponStatus.ACTIVE && next === DISCOUNT_STATUS.INACTIVE) return CouponHistoryAction.DEACTIVATED;
    if (current === CouponStatus.INACTIVE && next === DISCOUNT_STATUS.ACTIVE) return CouponHistoryAction.ACTIVATED;
    return CouponHistoryAction.UPDATED;
  }

  private toCouponStatus(status: CouponInput["status"]): CouponStatus {
    return status === DISCOUNT_STATUS.ACTIVE ? CouponStatus.ACTIVE : CouponStatus.INACTIVE;
  }

  private toCouponDiscountType(type: CouponInput["discountType"]): CouponDiscountType {
    if (type === COUPON_DISCOUNT_TYPE.FIXED) return CouponDiscountType.FIXED;
    if (type === COUPON_DISCOUNT_TYPE.FREE_SHIPPING) return CouponDiscountType.FREE_SHIPPING;
    return CouponDiscountType.PERCENTAGE;
  }

  private toCouponTargetType(type: CouponInput["targetType"]): CouponTargetType {
    if (type === COUPON_TARGET_TYPE.CATEGORIES) return CouponTargetType.CATEGORIES;
    if (type === COUPON_TARGET_TYPE.PRODUCTS) return CouponTargetType.PRODUCTS;
    return CouponTargetType.ALL_STORE;
  }

  private toCouponUsageLimitType(type: CouponInput["totalUsageLimitType"]): CouponUsageLimitType {
    return type === COUPON_USAGE_LIMIT_TYPE.LIMITED ? CouponUsageLimitType.LIMITED : CouponUsageLimitType.UNLIMITED;
  }

  private toCouponCustomerLimitType(type: CouponInput["customerLimitType"]): CouponCustomerLimitType {
    if (type === COUPON_CUSTOMER_LIMIT_TYPE.LIMITED) return CouponCustomerLimitType.LIMITED;
    if (type === COUPON_CUSTOMER_LIMIT_TYPE.FIRST_PURCHASE) return CouponCustomerLimitType.FIRST_PURCHASE;
    return CouponCustomerLimitType.UNLIMITED;
  }

  private toCouponDateLimitType(type: CouponInput["dateLimitType"]): CouponDateLimitType {
    return type === COUPON_DATE_LIMIT_TYPE.PERIOD ? CouponDateLimitType.PERIOD : CouponDateLimitType.UNLIMITED;
  }

  private toCouponMaxDiscountType(type: CouponInput["maxDiscountType"]): CouponMaxDiscountType {
    return type === COUPON_MAX_DISCOUNT_TYPE.AMOUNT ? CouponMaxDiscountType.AMOUNT : CouponMaxDiscountType.NONE;
  }

  private rethrowCouponConflict(error: unknown): void {
    if (isPrismaErrorCode(error, "P2002")) throw this.couponCodeConflict();
  }

  private couponCodeConflict(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.COUPON_CODE_ALREADY_EXISTS,
      message: "An active coupon with this code already exists.",
      ok: false,
    });
  }

  private invalidShippingInput(): BadRequestException {
    return new BadRequestException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Shipping discount configuration is invalid.", ok: false });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message, ok: false });
  }
}
