import {
  CommerceApiError,
  FetchCommerceApiClient,
  type CommerceApiClient,
} from "@/lib/api/commerce/client";
import { DATA_SOURCE } from "@/lib/api/config";
import { paymentProviderOrder, type PaymentProviderId, type PaymentStatus } from "@/lib/data/admin/payment-methods";
import {
  shippingProviderDefinitions,
  type PickupCostType,
  type PickupCoverageType,
  type ShippingConfigStatus,
  type ShippingModality,
} from "@/lib/data/admin/shipping/shipping-config";
import { DEFAULT_WEIGHT_RANGES } from "@/schemas/admin/shipping-schemas";
import type {
  CommerceRepository,
  Coupon,
  CreateCouponDTO,
  CreateShippingDiscountDTO,
  BankTransferConfig,
  PaymentMethodConfig,
  PickupAddress,
  PickupPoint,
  PickupScheduleRange,
  ShippingDiscount,
  ShippingOrigin,
  ShippingProvider,
  UpdateCouponDTO,
  UpdatePaymentMethodDTO,
  UpdatePickupPointDTO,
  UpdateShippingDiscountDTO,
  UpdateShippingProviderDTO,
} from "@/lib/api/commerce/commerce.repository";

const PAYMENT_PROVIDER_IDS = new Set<PaymentProviderId>(paymentProviderOrder);
const SHIPPING_PROVIDER_IDS = new Set(shippingProviderDefinitions.map((provider) => provider.id));
const DEFAULT_OPEN_ENDED_MAX_GRAMS = DEFAULT_WEIGHT_RANGES[DEFAULT_WEIGHT_RANGES.length - 1]?.maxGrams ?? 999999;

export class CommerceApiRepository implements CommerceRepository {
  readonly source = DATA_SOURCE.API;

  constructor(private readonly client: CommerceApiClient = new FetchCommerceApiClient()) {}

  async getPaymentMethods(): Promise<PaymentMethodConfig[]> {
    return this.getCollection("/admin/payment-methods", mapPaymentMethod);
  }

  async updatePaymentMethod(providerId: string, input: UpdatePaymentMethodDTO): Promise<PaymentMethodConfig> {
    const response = await this.client.put<unknown>(
      `/admin/payment-methods/${encodeURIComponent(providerId)}`,
      toPaymentMethodPayload(input),
    );
    return this.mapResponse(response, mapPaymentMethod);
  }

  async getShippingProviders(): Promise<ShippingProvider[]> {
    return this.getCollection("/admin/shipping/providers", mapShippingProvider);
  }

  async updateShippingProvider(providerId: string, input: UpdateShippingProviderDTO): Promise<ShippingProvider> {
    const response = await this.client.put<unknown>(
      `/admin/shipping/providers/${encodeURIComponent(providerId)}`,
      toShippingProviderPayload(input),
    );
    return this.mapResponse(response, mapShippingProvider);
  }

  async getPickupPoints(): Promise<PickupPoint[]> {
    return this.getCollection("/admin/pickup-points", mapPickupPoint);
  }

  async updatePickupPoint(id: string, input: UpdatePickupPointDTO): Promise<PickupPoint> {
    const response = await this.client.put<unknown>(
      `/admin/pickup-points/${encodeURIComponent(id)}`,
      toPickupPointPayload(input),
    );
    return this.mapResponse(response, mapPickupPoint);
  }

  async getCoupons(): Promise<Coupon[]> {
    return this.getCollection("/admin/discounts/coupons", mapCoupon);
  }

  async createCoupon(input: CreateCouponDTO): Promise<Coupon> {
    const response = await this.client.post<unknown>(
      "/admin/discounts/coupons",
      toCouponPayload(input),
    );
    return this.mapResponse(response, mapCoupon);
  }

  async updateCoupon(id: string, input: UpdateCouponDTO): Promise<Coupon> {
    const response = await this.client.put<unknown>(
      `/admin/discounts/coupons/${encodeURIComponent(id)}`,
      toCouponPayload(input),
    );
    return this.mapResponse(response, mapCoupon);
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.deleteResource(`/admin/discounts/coupons/${encodeURIComponent(id)}`);
  }

  async getShippingDiscounts(): Promise<ShippingDiscount[]> {
    return this.getCollection("/admin/discounts/shipping", mapShippingDiscount);
  }

  async createShippingDiscount(input: CreateShippingDiscountDTO): Promise<ShippingDiscount> {
    const response = await this.client.post<unknown>(
      "/admin/discounts/shipping",
      toShippingDiscountPayload(input),
    );
    return this.mapResponse(response, mapShippingDiscount);
  }

  async updateShippingDiscount(id: string, input: UpdateShippingDiscountDTO): Promise<ShippingDiscount> {
    const response = await this.client.put<unknown>(
      `/admin/discounts/shipping/${encodeURIComponent(id)}`,
      toShippingDiscountPayload(input),
    );
    return this.mapResponse(response, mapShippingDiscount);
  }

  async deleteShippingDiscount(id: string): Promise<void> {
    await this.deleteResource(`/admin/discounts/shipping/${encodeURIComponent(id)}`);
  }

  private async getCollection<T>(path: string, mapper: (value: unknown) => T): Promise<T[]> {
    const response = await this.client.get<unknown>(path);
    return this.mapResponse(response, (value) => {
      if (!Array.isArray(value)) throw invalidResponse();
      return value.map(mapper);
    });
  }

  private async deleteResource(path: string): Promise<void> {
    const response = await this.client.delete<unknown>(path);
    this.mapResponse(response, assertSuccess);
  }

  private mapResponse<T>(response: unknown, mapper: (value: unknown) => T): T {
    try {
      return mapper(unwrapResponse(response));
    } catch (error) {
      if (error instanceof CommerceApiError) throw error;
      throw invalidResponse();
    }
  }
}

function toPaymentMethodPayload(input: UpdatePaymentMethodDTO): Record<string, unknown> {
  return {
    ...(input.bankConfig === undefined ? {} : { bankConfig: input.bankConfig }),
    ...(input.selectedOptionId === undefined ? {} : { selectedOptionId: input.selectedOptionId }),
    status: input.status,
  };
}

function toShippingProviderPayload(input: UpdateShippingProviderDTO): Record<string, unknown> {
  const origin = input.status === "not_configured" ? undefined : input.origin;

  return {
    enabledModalities: [...input.enabledModalities],
    ...(input.freeShippingThreshold === undefined ? {} : { freeShippingThreshold: input.freeShippingThreshold }),
    ...(origin ? { origin: toShippingOriginPayload(origin) } : {}),
    status: input.status,
    weightRanges: input.weightRanges.map((range, index) => ({
      cost: range.cost,
      id: range.id,
      maxGrams: toApiMaxGrams(range.maxGrams, index),
      minGrams: range.minGrams,
    })),
  };
}

function toShippingOriginPayload(origin: ShippingOrigin): ShippingOrigin {
  return {
    apartment: origin.apartment,
    city: origin.city,
    cuitCuil: origin.cuitCuil,
    email: origin.email,
    floor: origin.floor,
    number: origin.number,
    phone: origin.phone,
    postalCode: origin.postalCode,
    province: origin.province,
    reference: origin.reference,
    senderName: origin.senderName,
    street: origin.street,
  };
}

function toPickupPointPayload(input: UpdatePickupPointDTO): Record<string, unknown> {
  return {
    ...(input.status === "not_configured" ? {} : { address: toPickupAddressPayload(input.address) }),
    ...(input.contactEmail === undefined ? {} : { contactEmail: input.contactEmail }),
    ...(input.contactName === undefined ? {} : { contactName: input.contactName }),
    ...(input.contactPhone === undefined ? {} : { contactPhone: input.contactPhone }),
    costType: input.costType,
    coverageType: input.coverageType,
    ...(input.fixedCost === undefined ? {} : { fixedCost: input.fixedCost }),
    isMain: input.isMain,
    name: input.name,
    preparationHours: input.preparationHours,
    provinces: [...input.provinces],
    schedule: input.schedule.map((range) => ({
      day: range.day,
      from: range.from,
      id: range.id,
      to: range.to,
    })),
    status: input.status,
  };
}

function toPickupAddressPayload(address: PickupAddress): PickupAddress {
  return { ...address };
}

function toCouponPayload(input: CreateCouponDTO | UpdateCouponDTO): Record<string, unknown> {
  return {
    ...input,
    categoryIds: [...input.categoryIds],
    code: input.code.trim().toUpperCase(),
    productIds: [...input.productIds],
  };
}

function toShippingDiscountPayload(input: CreateShippingDiscountDTO | UpdateShippingDiscountDTO): Record<string, unknown> {
  return {
    ...input,
    categoryIds: [...input.categoryIds],
    shippingMethodIds: [...input.shippingMethodIds],
    zoneIds: [...input.zoneIds],
  };
}

function mapPaymentMethod(value: unknown): PaymentMethodConfig {
  const record = asRecord(value);
  const id = paymentProviderId(record.id);
  const bankConfig = id === "bank-transfer" ? mapBankTransferConfig(record.bankConfig) : undefined;
  const selectedOptionId = optionalString(record.selectedOptionId, "selectedOptionId");

  return {
    acceptedMethods: stringArray(record.acceptedMethods, "acceptedMethods"),
    ...(bankConfig ? { bankConfig } : {}),
    description: requiredString(record.description, "description"),
    id,
    logoSrc: requiredString(record.logoSrc, "logoSrc"),
    name: requiredString(record.name, "name"),
    options: paymentOptions(record.options),
    ...(selectedOptionId ? { selectedOptionId } : {}),
    status: paymentStatus(record.status),
    updatedAt: requiredString(record.updatedAt, "updatedAt"),
  };
}

function mapBankTransferConfig(value: unknown): BankTransferConfig | undefined {
  if (value === undefined || value === null) return undefined;
  const record = asRecord(value);

  return {
    alias: requiredString(record.alias, "bankConfig.alias"),
    bankName: requiredString(record.bankName, "bankConfig.bankName"),
    cbuCvu: requiredString(record.cbuCvu, "bankConfig.cbuCvu"),
    cuitCuil: requiredString(record.cuitCuil, "bankConfig.cuitCuil"),
    holderName: requiredString(record.holderName, "bankConfig.holderName"),
  };
}

function paymentOptions(value: unknown): PaymentMethodConfig["options"] {
  if (!Array.isArray(value)) throw invalidResponse();

  return value.map((item) => {
    const record = asRecord(item);
    return {
      fee: requiredString(record.fee, "options.fee"),
      id: requiredString(record.id, "options.id"),
      receiveIn: requiredString(record.receiveIn, "options.receiveIn"),
      salesIn: requiredString(record.salesIn, "options.salesIn"),
    };
  });
}

function mapShippingProvider(value: unknown): ShippingProvider {
  const record = asRecord(value);
  const id = shippingProviderId(record.id);

  return {
    enabledModalities: shippingModalities(record.enabledModalities),
    ...(optionalFiniteNumber(record.freeShippingThreshold, "freeShippingThreshold") === undefined
      ? {}
      : { freeShippingThreshold: optionalFiniteNumber(record.freeShippingThreshold, "freeShippingThreshold") }),
    id,
    name: requiredString(record.name, "name"),
    origin: mapShippingOrigin(record.origin),
    status: shippingStatus(record.status),
    updatedAt: requiredString(record.updatedAt, "updatedAt"),
    weightRanges: weightRanges(record.weightRanges),
  };
}

function mapShippingOrigin(value: unknown): ShippingOrigin {
  const record = asRecord(value);
  const apartment = optionalString(record.apartment, "origin.apartment");
  const cuitCuil = optionalString(record.cuitCuil, "origin.cuitCuil");
  const floor = optionalString(record.floor, "origin.floor");
  const reference = optionalString(record.reference, "origin.reference");

  return {
    city: stringValue(record.city, "origin.city"),
    email: stringValue(record.email, "origin.email"),
    number: stringValue(record.number, "origin.number"),
    phone: stringValue(record.phone, "origin.phone"),
    postalCode: stringValue(record.postalCode, "origin.postalCode"),
    province: stringValue(record.province, "origin.province"),
    senderName: stringValue(record.senderName, "origin.senderName"),
    street: stringValue(record.street, "origin.street"),
    ...(apartment ? { apartment } : {}),
    ...(cuitCuil ? { cuitCuil } : {}),
    ...(floor ? { floor } : {}),
    ...(reference ? { reference } : {}),
  };
}

function weightRanges(value: unknown): ShippingProvider["weightRanges"] {
  if (!Array.isArray(value)) throw invalidResponse();

  return value.map((item, index) => {
    const record = asRecord(item);
    const maxValue = record.maxGrams === undefined ? record.maxWeightGrams : record.maxGrams;
    const maxGrams = maxValue === null
      ? DEFAULT_WEIGHT_RANGES[index]?.maxGrams ?? DEFAULT_OPEN_ENDED_MAX_GRAMS
      : nonNegativeInteger(maxValue, `weightRanges.${index}.maxGrams`);

    return {
      cost: nonNegativeNumber(record.cost, `weightRanges.${index}.cost`),
      id: requiredString(record.id, `weightRanges.${index}.id`),
      maxGrams,
      minGrams: nonNegativeInteger(record.minGrams, `weightRanges.${index}.minGrams`),
    };
  });
}

function mapPickupPoint(value: unknown): PickupPoint {
  const record = asRecord(value);
  const contactEmail = optionalString(record.contactEmail, "contactEmail");
  const contactName = optionalString(record.contactName, "contactName");
  const contactPhone = optionalString(record.contactPhone, "contactPhone");
  const fixedCost = optionalFiniteNumber(record.fixedCost, "fixedCost");

  return {
    address: mapPickupAddress(record.address),
    ...(contactEmail ? { contactEmail } : {}),
    ...(contactName ? { contactName } : {}),
    ...(contactPhone ? { contactPhone } : {}),
    costType: pickupCostType(record.costType),
    coverageType: pickupCoverageType(record.coverageType),
    ...(fixedCost === undefined ? {} : { fixedCost }),
    id: requiredString(record.id, "id"),
    isMain: booleanValue(record.isMain, "isMain"),
    name: requiredString(record.name, "name"),
    preparationHours: positiveInteger(record.preparationHours, "preparationHours"),
    provinces: stringArray(record.provinces, "provinces"),
    schedule: pickupSchedule(record.schedule),
    status: pickupStatus(record.status),
    updatedAt: requiredString(record.updatedAt, "updatedAt"),
  };
}

function mapPickupAddress(value: unknown): PickupAddress {
  const record = asRecord(value);
  return {
    city: stringValue(record.city, "address.city"),
    number: stringValue(record.number, "address.number"),
    postalCode: stringValue(record.postalCode, "address.postalCode"),
    province: stringValue(record.province, "address.province"),
    street: stringValue(record.street, "address.street"),
  };
}

function pickupSchedule(value: unknown): PickupScheduleRange[] {
  if (!Array.isArray(value)) throw invalidResponse();

  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      day: requiredString(record.day, `schedule.${index}.day`),
      from: requiredString(record.from, `schedule.${index}.from`),
      id: requiredString(record.id, `schedule.${index}.id`),
      to: requiredString(record.to, `schedule.${index}.to`),
    };
  });
}

function mapCoupon(value: unknown): Coupon {
  const record = asRecord(value);
  const customerUsageLimit = optionalInteger(record.customerUsageLimit, "customerUsageLimit");
  const discountValue = optionalFiniteNumber(record.discountValue, "discountValue");
  const endDate = optionalString(record.endDate, "endDate");
  const maxDiscountAmount = optionalFiniteNumber(record.maxDiscountAmount, "maxDiscountAmount");
  const startDate = optionalString(record.startDate, "startDate");
  const totalUsageLimit = optionalInteger(record.totalUsageLimit, "totalUsageLimit");

  return {
    canCombineWithPromotions: booleanValue(record.canCombineWithPromotions, "canCombineWithPromotions"),
    categoryIds: stringArray(record.categoryIds, "categoryIds"),
    code: requiredString(record.code, "code"),
    createdAt: requiredString(record.createdAt, "createdAt"),
    customerLimitType: couponCustomerLimitType(record.customerLimitType),
    ...(customerUsageLimit === undefined ? {} : { customerUsageLimit }),
    dateLimitType: couponDateLimitType(record.dateLimitType),
    discountType: couponDiscountType(record.discountType),
    ...(discountValue === undefined ? {} : { discountValue }),
    ...(endDate ? { endDate } : {}),
    history: couponHistory(record.history),
    id: requiredString(record.id, "id"),
    includeShippingCost: booleanValue(record.includeShippingCost, "includeShippingCost"),
    ...(maxDiscountAmount === undefined ? {} : { maxDiscountAmount }),
    maxDiscountType: couponMaxDiscountType(record.maxDiscountType),
    minimumCartAmount: nonNegativeNumber(record.minimumCartAmount, "minimumCartAmount"),
    productIds: stringArray(record.productIds, "productIds"),
    ...(startDate ? { startDate } : {}),
    status: discountStatus(record.status),
    targetType: couponTargetType(record.targetType),
    ...(totalUsageLimit === undefined ? {} : { totalUsageLimit }),
    totalUsageLimitType: couponUsageLimitType(record.totalUsageLimitType),
    updatedAt: requiredString(record.updatedAt, "updatedAt"),
    usageCount: nonNegativeInteger(record.usageCount, "usageCount"),
  };
}

function couponHistory(value: unknown): Coupon["history"] {
  if (!Array.isArray(value)) throw invalidResponse();

  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      action: couponHistoryAction(record.action),
      createdAt: requiredString(record.createdAt, `history.${index}.createdAt`),
      id: requiredString(record.id, `history.${index}.id`),
      label: requiredString(record.label, `history.${index}.label`),
      userName: requiredString(record.userName, `history.${index}.userName`),
    };
  });
}

function mapShippingDiscount(value: unknown): ShippingDiscount {
  const record = asRecord(value);
  return {
    canCombineWithPromotions: booleanValue(record.canCombineWithPromotions, "canCombineWithPromotions"),
    categoryIds: stringArray(record.categoryIds, "categoryIds"),
    createdAt: requiredString(record.createdAt, "createdAt"),
    id: requiredString(record.id, "id"),
    minimumCartAmount: nonNegativeNumber(record.minimumCartAmount, "minimumCartAmount"),
    onlyCheapestShippingMethod: booleanValue(record.onlyCheapestShippingMethod, "onlyCheapestShippingMethod"),
    shippingMethodIds: stringArray(record.shippingMethodIds, "shippingMethodIds"),
    status: discountStatus(record.status),
    targetType: shippingDiscountTargetType(record.targetType),
    updatedAt: requiredString(record.updatedAt, "updatedAt"),
    zoneIds: stringArray(record.zoneIds, "zoneIds"),
    zoneTargetType: shippingZoneTargetType(record.zoneTargetType),
  };
}

function unwrapResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) throw invalidResponse();
  return value.ok === true && "data" in value ? value.data : value;
}

function assertSuccess(value: unknown): void {
  if (!isRecord(value) || value.ok !== true) throw invalidResponse();
}

function paymentProviderId(value: unknown): PaymentProviderId {
  if (typeof value === "string" && PAYMENT_PROVIDER_IDS.has(value as PaymentProviderId)) {
    return value as PaymentProviderId;
  }
  throw invalidResponse();
}

function shippingProviderId(value: unknown): ShippingProvider["id"] {
  if (typeof value === "string" && SHIPPING_PROVIDER_IDS.has(value as ShippingProvider["id"])) return value as ShippingProvider["id"];
  throw invalidResponse();
}

function paymentStatus(value: unknown): PaymentStatus {
  if (value === "active" || value === "inactive") return value;
  throw invalidResponse();
}

function shippingStatus(value: unknown): ShippingConfigStatus {
  if (value === "active" || value === "configured_inactive" || value === "not_configured") return value;
  throw invalidResponse();
}

function pickupStatus(value: unknown): PickupPoint["status"] {
  if (value === "active" || value === "configured_inactive" || value === "not_configured") return value;
  throw invalidResponse();
}

function pickupCostType(value: unknown): PickupCostType {
  if (value === "free" || value === "fixed") return value;
  throw invalidResponse();
}

function pickupCoverageType(value: unknown): PickupCoverageType {
  if (value === "all" || value === "provinces") return value;
  throw invalidResponse();
}

function shippingModalities(value: unknown): ShippingModality[] {
  return stringArray(value, "enabledModalities").map((modality) => {
    if (modality === "home_delivery" || modality === "branch_delivery") return modality;
    throw invalidResponse();
  });
}

function couponDiscountType(value: unknown): Coupon["discountType"] {
  if (value === "percentage" || value === "fixed" || value === "free_shipping") return value;
  throw invalidResponse();
}

function couponTargetType(value: unknown): Coupon["targetType"] {
  if (value === "all_store" || value === "categories" || value === "products") return value;
  throw invalidResponse();
}

function couponUsageLimitType(value: unknown): Coupon["totalUsageLimitType"] {
  if (value === "unlimited" || value === "limited") return value;
  throw invalidResponse();
}

function couponCustomerLimitType(value: unknown): Coupon["customerLimitType"] {
  if (value === "unlimited" || value === "limited" || value === "first_purchase") return value;
  throw invalidResponse();
}

function couponDateLimitType(value: unknown): Coupon["dateLimitType"] {
  if (value === "unlimited" || value === "period") return value;
  throw invalidResponse();
}

function couponMaxDiscountType(value: unknown): Coupon["maxDiscountType"] {
  if (value === "none" || value === "amount") return value;
  throw invalidResponse();
}

function couponHistoryAction(value: unknown): Coupon["history"][number]["action"] {
  if (value === "created" || value === "activated" || value === "deactivated" || value === "updated") return value;
  throw invalidResponse();
}

function discountStatus(value: unknown): Coupon["status"] {
  if (value === "active" || value === "inactive") return value;
  throw invalidResponse();
}

function shippingDiscountTargetType(value: unknown): ShippingDiscount["targetType"] {
  if (value === "all_store" || value === "categories") return value;
  throw invalidResponse();
}

function shippingZoneTargetType(value: unknown): ShippingDiscount["zoneTargetType"] {
  if (value === "all" || value === "specific") return value;
  throw invalidResponse();
}

function stringArray(value: unknown, field: string): string[] {
  void field;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw invalidResponse();
  return value.map((item) => item.trim());
}

function requiredString(value: unknown, field: string): string {
  const result = stringValue(value, field);
  if (!result) throw invalidResponse();
  return result;
}

function stringValue(value: unknown, _field: string): string {
  void _field;
  if (typeof value !== "string") throw invalidResponse();
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  const result = stringValue(value, field);
  return result || undefined;
}

function finiteNumber(value: unknown, _field: string): number {
  void _field;
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) throw invalidResponse();
  return result;
}

function nonNegativeNumber(value: unknown, field: string): number {
  const result = finiteNumber(value, field);
  if (result < 0) throw invalidResponse();
  return result;
}

function optionalFiniteNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return finiteNumber(value, field);
}

function nonNegativeInteger(value: unknown, field: string): number {
  const result = nonNegativeNumber(value, field);
  if (!Number.isInteger(result)) throw invalidResponse();
  return result;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return nonNegativeInteger(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const result = nonNegativeInteger(value, field);
  if (result < 1) throw invalidResponse();
  return result;
}

function booleanValue(value: unknown, _field: string): boolean {
  void _field;
  if (typeof value !== "boolean") throw invalidResponse();
  return value;
}

function toApiMaxGrams(value: number, index: number): number | null {
  const expected = DEFAULT_WEIGHT_RANGES[index];
  return expected && index === DEFAULT_WEIGHT_RANGES.length - 1 && value === expected.maxGrams ? null : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResponse(): CommerceApiError {
  return new CommerceApiError({
    code: "COMMERCE_API_INVALID_RESPONSE",
    message: "The commerce API returned an invalid response.",
    status: 502,
  });
}

export type {
  BankTransferConfig,
  CommerceRepository,
  Coupon,
  CreateCouponDTO,
  CreateShippingDiscountDTO,
  PaymentMethodConfig,
  PickupPoint,
  ShippingDiscount,
  ShippingOrigin,
  ShippingProvider,
  UpdateCouponDTO,
  UpdatePaymentMethodDTO,
  UpdatePickupPointDTO,
  UpdateShippingDiscountDTO,
  UpdateShippingProviderDTO,
};
