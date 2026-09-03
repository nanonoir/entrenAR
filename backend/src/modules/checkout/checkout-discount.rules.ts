import { ConflictException, Injectable } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import {
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
} from "../../generated/prisma/enums";
import {
  CHECKOUT_COUPON_RESULT,
} from "./checkout.constants";
import type {
  CheckoutCouponResultProjection,
  CheckoutShippingOptionProjection,
} from "./checkout.mapper";
import {
  CheckoutRepository,
  hashCheckoutToken,
  type TransactionClient,
} from "./checkout.repository";
import type { ResolvedCheckoutLine } from "./checkout-line-resolver";
import {
  toShippingDiscountProjection,
  type CouponRecord,
  type ShippingDiscountRecord,
} from "../commerce/commerce.mapper";
import { CommerceRepository } from "../commerce/commerce.repository";
import { slugify } from "../catalog/catalog.schemas";
import { roundMoney } from "./checkout-line-resolver";

export interface CheckoutDiscountInput {
  couponCode?: string;
  customerEmail?: string;
  province?: string;
  shippingMethodId?: string;
}

export interface CouponCalculation {
  productDiscount: number;
  projection: CheckoutCouponResultProjection;
  record: CouponRecord;
  shippingDiscount: number;
  totalDiscount: number;
}

export interface DiscountRulesCalculation {
  couponCalculation?: CouponCalculation;
  productDiscount: number;
  shippingDiscount: number;
}

const PROVINCE_ZONE_ALIASES: Readonly<Record<string, string>> = {
  "ciudad-autonoma-de-buenos-aires": "ar-caba",
  caba: "ar-caba",
};

@Injectable()
export class CheckoutDiscountRules {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly commerceRepository: CommerceRepository,
  ) {}

  async calculate(
    transaction: TransactionClient,
    input: CheckoutDiscountInput,
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
    shipping: number,
    shippingOptions: readonly CheckoutShippingOptionProjection[],
    userId: string | undefined,
    now: Date,
    lockForCompletion: boolean,
  ): Promise<DiscountRulesCalculation> {
    const couponCalculation = await this.couponCalculation(
      transaction,
      input,
      lines,
      subtotal,
      shipping,
      userId,
      now,
      lockForCompletion,
    );
    const automaticShippingDiscount = this.automaticShippingDiscount(
      await this.commerceRepository.checkoutShippingDiscounts(transaction),
      input.shippingMethodId,
      lines,
      subtotal,
      input.province,
      shipping,
      shippingOptions,
    );
    const couponShippingDiscount = couponCalculation?.shippingDiscount ?? 0;

    return {
      ...(couponCalculation ? { couponCalculation } : {}),
      productDiscount: couponCalculation?.productDiscount ?? 0,
      shippingDiscount: roundMoney(couponShippingDiscount + automaticShippingDiscount),
    };
  }

  couponUsageLimitReached(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.COUPON_USAGE_LIMIT_REACHED,
      message: "The coupon usage limit has been reached.",
      ok: false,
    });
  }

  private async couponCalculation(
    transaction: TransactionClient,
    input: CheckoutDiscountInput,
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
    shipping: number,
    userId: string | undefined,
    now: Date,
    lockForCompletion: boolean,
  ): Promise<CouponCalculation | undefined> {
    if (!input.couponCode) return undefined;

    let coupon = await this.commerceRepository.checkoutCouponByCode(transaction, input.couponCode);
    if (!coupon) throw this.couponNotValid();
    if (lockForCompletion) {
      await this.checkoutRepository.lockCoupon(transaction, coupon.id);
      coupon = await this.commerceRepository.checkoutCouponByCode(transaction, input.couponCode);
      if (!coupon) throw this.couponNotValid();
    }

    this.assertCouponEligibility(coupon, lines, subtotal, userId, input.customerEmail, now);
    const identity = userId
      ? { userId }
      : input.customerEmail
        ? { customerKeyHash: hashCheckoutToken(input.customerEmail) }
        : {};
    if (coupon.customerLimitType === CouponCustomerLimitType.LIMITED) {
      if (!identity.userId && !identity.customerKeyHash) throw this.couponNotValid();
      const count = await this.checkoutRepository.couponRedemptionCount(transaction, coupon.id, identity);
      if (coupon.customerUsageLimit === null || count >= coupon.customerUsageLimit) throw this.couponUsageLimitReached();
    }
    if (coupon.customerLimitType === CouponCustomerLimitType.FIRST_PURCHASE) {
      if (!userId || await this.checkoutRepository.hasPaidCustomerOrder(transaction, userId)) {
        throw this.couponNotValid();
      }
    }

    const configuredValue = coupon.discountValue === null ? 0 : decimalToNumber(coupon.discountValue);
    let totalDiscount = 0;
    if (coupon.discountType === CouponDiscountType.FREE_SHIPPING) {
      totalDiscount = shipping;
    } else {
      const base = coupon.includeShippingCost ? subtotal + shipping : subtotal;
      totalDiscount = coupon.discountType === CouponDiscountType.PERCENTAGE
        ? roundMoney(base * configuredValue / 100)
        : roundMoney(configuredValue);
      if (coupon.maxDiscountAmount !== null) totalDiscount = Math.min(totalDiscount, decimalToNumber(coupon.maxDiscountAmount));
      totalDiscount = Math.min(totalDiscount, base);
    }

    const productDiscount = coupon.discountType === CouponDiscountType.FREE_SHIPPING
      ? 0
      : Math.min(totalDiscount, subtotal);
    const shippingDiscount = coupon.discountType === CouponDiscountType.FREE_SHIPPING
      ? shipping
      : coupon.includeShippingCost
        ? Math.min(Math.max(0, totalDiscount - productDiscount), shipping)
        : 0;

    return {
      productDiscount: roundMoney(productDiscount),
      projection: {
        code: coupon.code,
        discountAmount: roundMoney(productDiscount + shippingDiscount),
        result: CHECKOUT_COUPON_RESULT.APPLIED,
      },
      record: coupon,
      shippingDiscount: roundMoney(shippingDiscount),
      totalDiscount: roundMoney(productDiscount + shippingDiscount),
    };
  }

  private assertCouponEligibility(
    coupon: CouponRecord,
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
    userId: string | undefined,
    customerEmail: string | undefined,
    now: Date,
  ): void {
    if (coupon.status !== CouponStatus.ACTIVE || coupon.deletedAt !== null) throw this.couponNotValid();
    if (coupon.dateLimitType === CouponDateLimitType.PERIOD) {
      if ((coupon.startDate && coupon.startDate > now) || (coupon.endDate && coupon.endDate < now)) throw this.couponNotValid();
    }
    if (subtotal < decimalToNumber(coupon.minimumCartAmount)) throw this.couponNotValid();
    if (!coupon.canCombineWithPromotions && lines.some((line) => line.product.promotionalPrice !== undefined)) {
      throw this.couponNotValid();
    }
    if (coupon.targetType === CouponTargetType.CATEGORIES && !lines.some((line) => {
      return line.product.categoryIds.some((categoryId) => coupon.categories.some((category) => category.categoryId === categoryId));
    })) throw this.couponNotValid();
    if (coupon.targetType === CouponTargetType.PRODUCTS && !lines.some((line) => {
      return coupon.products.some((product) => product.productId === line.product.id);
    })) throw this.couponNotValid();
    if (coupon.totalUsageLimitType === CouponUsageLimitType.LIMITED
      && (coupon.totalUsageLimit === null || coupon.usageCount >= coupon.totalUsageLimit)) {
      throw this.couponUsageLimitReached();
    }
    if (coupon.customerLimitType === CouponCustomerLimitType.FIRST_PURCHASE && (!userId || !customerEmail)) {
      throw this.couponNotValid();
    }
  }

  private automaticShippingDiscount(
    records: readonly ShippingDiscountRecord[],
    methodId: string | undefined,
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
    province: string | undefined,
    shipping: number,
    shippingOptions: readonly CheckoutShippingOptionProjection[],
  ): number {
    if (!methodId || shipping <= 0) return 0;
    const zoneId = province ? provinceZoneId(province) : undefined;
    const selectedOption = shippingOptions.find((option) => option.id === methodId);
    const cheapestCost = shippingOptions.reduce<number | undefined>((cheapest, option) => {
      return cheapest === undefined ? option.cost : Math.min(cheapest, option.cost);
    }, undefined);
    const projections = records.map(toShippingDiscountProjection);
    const eligible = projections.some((discount) => {
      if (subtotal < discount.minimumCartAmount) return false;
      if (!discount.shippingMethodIds.includes(methodId)) return false;
      if (discount.onlyCheapestShippingMethod && (!selectedOption || cheapestCost === undefined || selectedOption.cost !== cheapestCost)) return false;
      if (discount.targetType === "categories" && !lines.some((line) => {
        return line.product.categoryIds.some((categoryId) => discount.categoryIds.includes(categoryId));
      })) return false;
      if (discount.zoneTargetType === "specific" && (!zoneId || !discount.zoneIds.includes(zoneId))) return false;
      return true;
    });

    return eligible ? shipping : 0;
  }

  private couponNotValid(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.COUPON_NOT_VALID,
      message: "The coupon is not valid for this checkout.",
      ok: false,
    });
  }
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Checkout money values must serialize to finite numbers.");
  return numberValue;
}

function normalizeLocation(value: string): string {
  return slugify(value);
}

function provinceZoneId(value: string): string {
  const normalized = normalizeLocation(value);
  return PROVINCE_ZONE_ALIASES[normalized] ?? `ar-${normalized}`;
}
