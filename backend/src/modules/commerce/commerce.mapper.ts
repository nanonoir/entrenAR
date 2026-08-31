import type { Prisma } from "../../generated/prisma/client";
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
  ShippingDiscountTargetType,
  ShippingProviderStatus,
  ShippingZoneTargetType,
} from "../../generated/prisma/enums";
import {
  COUPON_CUSTOMER_LIMIT_TYPE,
  COUPON_DATE_LIMIT_TYPE,
  COUPON_DISCOUNT_TYPE,
  COUPON_HISTORY_ACTION,
  COUPON_MAX_DISCOUNT_TYPE,
  COUPON_TARGET_TYPE,
  COUPON_USAGE_LIMIT_TYPE,
  DISCOUNT_STATUS,
  FIXED_WEIGHT_BANDS,
  PAYMENT_STATUS,
  PICKUP_COST_TYPE,
  PICKUP_COVERAGE_TYPE,
  PICKUP_POINT_STATUS,
  SHIPPING_MODALITY,
  SHIPPING_DISCOUNT_TARGET_TYPE,
  SHIPPING_PROVIDER_STATUS,
  SHIPPING_ZONE_TARGET_TYPE,
  normalizeShippingMethodId,
} from "./commerce.constants";
import type {
  CouponCustomerLimitType as CouponCustomerLimitValue,
  CouponDateLimitType as CouponDateLimitValue,
  CouponDiscountType as CouponDiscountValue,
  CouponHistoryAction as CouponHistoryActionValue,
  CouponMaxDiscountType as CouponMaxDiscountValue,
  CouponTargetType as CouponTargetValue,
  CouponUsageLimitType as CouponUsageLimitValue,
  DiscountStatus,
  PaymentStatus,
  PickupCostType as PickupCostValue,
  PickupCoverageType as PickupCoverageValue,
  PickupPointStatus as PickupPointStatusValue,
  ShippingDiscountTargetType as ShippingDiscountTargetValue,
  ShippingModality,
  ShippingProviderStatus as ShippingProviderStatusValue,
  ShippingZoneTargetType as ShippingZoneTargetValue,
} from "./commerce.constants";

export const paymentMethodSelect = {
  acceptedMethods: true,
  bankConfig: true,
  description: true,
  id: true,
  logoSrc: true,
  name: true,
  options: true,
  selectedOptionId: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.PaymentMethodConfigSelect;

export type PaymentMethodRecord = Prisma.PaymentMethodConfigGetPayload<{ select: typeof paymentMethodSelect }>;

const weightBandSelect = {
  cost: true,
  id: true,
  maxWeightGrams: true,
  minWeightGrams: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.WeightBandSelect;

export const shippingProviderSelect = {
  enabledModalities: true,
  freeShippingThreshold: true,
  id: true,
  name: true,
  originApartment: true,
  originCity: true,
  originCuitCuil: true,
  originEmail: true,
  originFloor: true,
  originNumber: true,
  originPhone: true,
  originProvince: true,
  originReference: true,
  originSenderName: true,
  originStreet: true,
  originPostalCode: true,
  status: true,
  updatedAt: true,
  weightBands: {
    orderBy: [{ sortOrder: "asc" }, { minWeightGrams: "asc" }, { id: "asc" }],
    select: weightBandSelect,
  },
} satisfies Prisma.ShippingProviderSelect;

export type ShippingProviderRecord = Prisma.ShippingProviderGetPayload<{ select: typeof shippingProviderSelect }>;

const pickupScheduleSelect = {
  closesAt: true,
  dayOfWeek: true,
  id: true,
  opensAt: true,
  sortOrder: true,
} satisfies Prisma.PickupPointScheduleSelect;

export const pickupPointSelect = {
  city: true,
  contactEmail: true,
  contactName: true,
  contactPhone: true,
  costType: true,
  coverageType: true,
  fixedCost: true,
  id: true,
  isMain: true,
  name: true,
  number: true,
  postalCode: true,
  preparationHours: true,
  province: true,
  provinces: true,
  schedules: {
    orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }, { id: "asc" }],
    select: pickupScheduleSelect,
  },
  status: true,
  street: true,
  updatedAt: true,
} satisfies Prisma.PickupPointSelect;

export type PickupPointRecord = Prisma.PickupPointGetPayload<{ select: typeof pickupPointSelect }>;

const couponCategorySelect = { categoryId: true } satisfies Prisma.CouponCategorySelect;
const couponProductSelect = { productId: true } satisfies Prisma.CouponProductSelect;
const couponHistorySelect = {
  action: true,
  actorName: true,
  createdAt: true,
  id: true,
} satisfies Prisma.CouponHistorySelect;

export const couponSelect = {
  canCombineWithPromotions: true,
  categories: { orderBy: { categoryId: "asc" }, select: couponCategorySelect },
  code: true,
  createdAt: true,
  customerLimitType: true,
  customerUsageLimit: true,
  dateLimitType: true,
  deletedAt: true,
  discountType: true,
  discountValue: true,
  endDate: true,
  history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: couponHistorySelect },
  id: true,
  includeShippingCost: true,
  maxDiscountAmount: true,
  maxDiscountType: true,
  minimumCartAmount: true,
  products: { orderBy: { productId: "asc" }, select: couponProductSelect },
  startDate: true,
  status: true,
  targetType: true,
  totalUsageLimit: true,
  totalUsageLimitType: true,
  updatedAt: true,
  usageCount: true,
} satisfies Prisma.CouponSelect;

export type CouponRecord = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

export const shippingDiscountSelect = {
  canCombineWithPromotions: true,
  categories: { orderBy: { categoryId: "asc" }, select: { categoryId: true } },
  createdAt: true,
  deletedAt: true,
  id: true,
  minimumCartAmount: true,
  onlyCheapestShippingMethod: true,
  shippingMethodIds: true,
  status: true,
  targetType: true,
  updatedAt: true,
  zoneIds: true,
  zoneTargetType: true,
} satisfies Prisma.ShippingDiscountSelect;

export type ShippingDiscountRecord = Prisma.ShippingDiscountGetPayload<{ select: typeof shippingDiscountSelect }>;

export interface PaymentOptionProjection {
  fee: string;
  id: string;
  receiveIn: string;
  salesIn: string;
}

export interface BankTransferConfigProjection {
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
  holderName: string;
}

export interface PaymentMethodProjection {
  acceptedMethods: string[];
  bankConfig?: BankTransferConfigProjection;
  description: string;
  id: string;
  logoSrc: string;
  name: string;
  options: PaymentOptionProjection[];
  selectedOptionId?: string;
  status: PaymentStatus;
  updatedAt: string;
}

export interface WeightBandProjection {
  cost: number;
  id: string;
  maxGrams: number | null;
  minGrams: number;
}

export interface ShippingOriginProjection {
  city: string;
  email: string;
  number: string;
  phone: string;
  postalCode: string;
  province: string;
  senderName: string;
  street: string;
  apartment?: string;
  cuitCuil?: string;
  floor?: string;
  reference?: string;
}

export interface ShippingProviderProjection {
  enabledModalities: ShippingModality[];
  freeShippingThreshold?: number;
  id: string;
  name: string;
  origin: ShippingOriginProjection;
  status: ShippingProviderStatusValue;
  updatedAt: string;
  weightRanges: WeightBandProjection[];
}

export interface PickupScheduleProjection {
  day: string;
  from: string;
  id: string;
  to: string;
}

export interface PickupPointProjection {
  address: {
    city: string;
    number: string;
    postalCode: string;
    province: string;
    street: string;
  };
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  costType: PickupCostValue;
  coverageType: PickupCoverageValue;
  fixedCost?: number;
  id: string;
  isMain: boolean;
  name: string;
  preparationHours: number;
  provinces: string[];
  schedule: PickupScheduleProjection[];
  status: PickupPointStatusValue;
  updatedAt: string;
}

export interface CouponHistoryProjection {
  action: CouponHistoryActionValue;
  createdAt: string;
  id: string;
  label: string;
  userName: string;
}

export interface CouponProjection {
  canCombineWithPromotions: boolean;
  categoryIds: string[];
  code: string;
  createdAt: string;
  customerLimitType: CouponCustomerLimitValue;
  customerUsageLimit?: number;
  dateLimitType: CouponDateLimitValue;
  discountType: CouponDiscountValue;
  discountValue?: number;
  endDate?: string;
  history: CouponHistoryProjection[];
  id: string;
  includeShippingCost: boolean;
  maxDiscountAmount?: number;
  maxDiscountType: CouponMaxDiscountValue;
  minimumCartAmount: number;
  productIds: string[];
  startDate?: string;
  status: DiscountStatus;
  targetType: CouponTargetValue;
  totalUsageLimit?: number;
  totalUsageLimitType: CouponUsageLimitValue;
  updatedAt: string;
  usageCount: number;
}

export interface ShippingDiscountProjection {
  canCombineWithPromotions: boolean;
  categoryIds: string[];
  createdAt: string;
  id: string;
  minimumCartAmount: number;
  onlyCheapestShippingMethod: boolean;
  shippingMethodIds: string[];
  status: DiscountStatus;
  targetType: ShippingDiscountTargetValue;
  updatedAt: string;
  zoneIds: string[];
  zoneTargetType: ShippingZoneTargetValue;
}

export function toPaymentMethodProjection(record: PaymentMethodRecord): PaymentMethodProjection {
  const bankConfig = record.id === "bank-transfer" ? toBankTransferConfig(record.bankConfig) : undefined;

  return {
    acceptedMethods: jsonStringArray(record.acceptedMethods),
    ...(bankConfig ? { bankConfig } : {}),
    description: record.description,
    id: record.id,
    logoSrc: record.logoSrc,
    name: record.name,
    options: jsonPaymentOptions(record.options),
    ...(record.selectedOptionId ? { selectedOptionId: record.selectedOptionId } : {}),
    status: toPaymentStatus(record.status),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const toPaymentMethodConfig = toPaymentMethodProjection;

export function toShippingProviderProjection(record: ShippingProviderRecord): ShippingProviderProjection {
  const freeShippingThreshold = record.freeShippingThreshold === null
    ? undefined
    : decimalToNumber(record.freeShippingThreshold);

  return {
    enabledModalities: jsonShippingModalities(record.enabledModalities),
    ...(freeShippingThreshold === undefined ? {} : { freeShippingThreshold }),
    id: record.id,
    name: record.name,
    origin: {
      city: record.originCity ?? "",
      email: record.originEmail ?? "",
      number: record.originNumber ?? "",
      phone: record.originPhone ?? "",
      postalCode: record.originPostalCode ?? "",
      province: record.originProvince ?? "",
      senderName: record.originSenderName ?? "",
      street: record.originStreet ?? "",
      ...(record.originApartment ? { apartment: record.originApartment } : {}),
      ...(record.originCuitCuil ? { cuitCuil: record.originCuitCuil } : {}),
      ...(record.originFloor ? { floor: record.originFloor } : {}),
      ...(record.originReference ? { reference: record.originReference } : {}),
    },
    status: toShippingProviderStatus(record.status),
    updatedAt: record.updatedAt.toISOString(),
    weightRanges: record.weightBands.map(toWeightBandProjection),
  };
}

export const toShippingProvider = toShippingProviderProjection;

export function toPickupPointProjection(record: PickupPointRecord): PickupPointProjection {
  const fixedCost = record.fixedCost === null ? undefined : decimalToNumber(record.fixedCost);

  return {
    address: {
      city: record.city ?? "",
      number: record.number ?? "",
      postalCode: record.postalCode ?? "",
      province: record.province ?? "",
      street: record.street ?? "",
    },
    ...(record.contactEmail ? { contactEmail: record.contactEmail } : {}),
    ...(record.contactName ? { contactName: record.contactName } : {}),
    ...(record.contactPhone ? { contactPhone: record.contactPhone } : {}),
    costType: toPickupCostType(record.costType),
    coverageType: toPickupCoverageType(record.coverageType),
    ...(fixedCost === undefined ? {} : { fixedCost }),
    id: record.id,
    isMain: record.isMain,
    name: record.name,
    preparationHours: record.preparationHours,
    provinces: jsonStringArray(record.provinces),
    schedule: record.schedules.map((schedule) => ({
      day: schedule.dayOfWeek,
      from: schedule.opensAt,
      id: schedule.id,
      to: schedule.closesAt,
    })),
    status: toPickupPointStatus(record.status),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const toPickupPoint = toPickupPointProjection;

export function toCouponProjection(record: CouponRecord): CouponProjection {
  return {
    canCombineWithPromotions: record.canCombineWithPromotions,
    categoryIds: record.categories.map((category) => category.categoryId),
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    customerLimitType: toCouponCustomerLimitType(record.customerLimitType),
    ...(record.customerUsageLimit === null ? {} : { customerUsageLimit: record.customerUsageLimit }),
    dateLimitType: toCouponDateLimitType(record.dateLimitType),
    discountType: toCouponDiscountType(record.discountType),
    ...(record.discountValue === null ? {} : { discountValue: decimalToNumber(record.discountValue) }),
    ...(record.endDate === null ? {} : { endDate: record.endDate.toISOString().slice(0, 10) }),
    history: record.history.map(toCouponHistoryProjection),
    id: record.id,
    includeShippingCost: record.includeShippingCost,
    ...(record.maxDiscountAmount === null ? {} : { maxDiscountAmount: decimalToNumber(record.maxDiscountAmount) }),
    maxDiscountType: toCouponMaxDiscountType(record.maxDiscountType),
    minimumCartAmount: decimalToNumber(record.minimumCartAmount),
    productIds: record.products.map((product) => product.productId),
    ...(record.startDate === null ? {} : { startDate: record.startDate.toISOString().slice(0, 10) }),
    status: toDiscountStatus(record.status),
    targetType: toCouponTargetType(record.targetType),
    ...(record.totalUsageLimit === null ? {} : { totalUsageLimit: record.totalUsageLimit }),
    totalUsageLimitType: toCouponUsageLimitType(record.totalUsageLimitType),
    updatedAt: record.updatedAt.toISOString(),
    usageCount: record.usageCount,
  };
}

export const toCoupon = toCouponProjection;

export function toShippingDiscountProjection(record: ShippingDiscountRecord): ShippingDiscountProjection {
  return {
    canCombineWithPromotions: record.canCombineWithPromotions,
    categoryIds: record.categories.map((category) => category.categoryId),
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    minimumCartAmount: decimalToNumber(record.minimumCartAmount),
    onlyCheapestShippingMethod: record.onlyCheapestShippingMethod,
    shippingMethodIds: jsonStringArray(record.shippingMethodIds).map(normalizeShippingMethodId),
    status: toDiscountStatus(record.status),
    targetType: toShippingDiscountTargetType(record.targetType),
    updatedAt: record.updatedAt.toISOString(),
    zoneIds: jsonStringArray(record.zoneIds),
    zoneTargetType: toShippingZoneTargetType(record.zoneTargetType),
  };
}

export const toShippingDiscount = toShippingDiscountProjection;

function toWeightBandProjection(record: ShippingProviderRecord["weightBands"][number]): WeightBandProjection {
  const canonical = FIXED_WEIGHT_BANDS.find((band) => band.minGrams === record.minWeightGrams && band.maxGrams === record.maxWeightGrams);

  return {
    cost: decimalToNumber(record.cost),
    id: canonical?.id ?? record.id,
    maxGrams: record.maxWeightGrams,
    minGrams: record.minWeightGrams,
  };
}

function toCouponHistoryProjection(history: CouponRecord["history"][number]): CouponHistoryProjection {
  const action = toCouponHistoryAction(history.action);

  return {
    action,
    createdAt: history.createdAt.toISOString(),
    id: history.id,
    label: couponHistoryLabel(action),
    userName: history.actorName ?? "System",
  };
}

function toBankTransferConfig(value: Prisma.JsonValue | null): BankTransferConfigProjection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const alias = stringRecordValue(record, "alias");
  const bankName = stringRecordValue(record, "bankName");
  const cbuCvu = stringRecordValue(record, "cbuCvu");
  const cuitCuil = stringRecordValue(record, "cuitCuil");
  const holderName = stringRecordValue(record, "holderName");
  if (!alias || !bankName || !cbuCvu || !cuitCuil || !holderName) {
    return undefined;
  }

  return {
    alias,
    bankName,
    cbuCvu,
    cuitCuil,
    holderName,
  };
}

function jsonPaymentOptions(value: Prisma.JsonValue): PaymentOptionProjection[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const fee = stringRecordValue(record, "fee");
    const id = stringRecordValue(record, "id");
    const receiveIn = stringRecordValue(record, "receiveIn");
    const salesIn = stringRecordValue(record, "salesIn");
    if (!fee || !id || !receiveIn || !salesIn) return [];
    return [{ fee, id, receiveIn, salesIn }];
  });
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function jsonShippingModalities(value: Prisma.JsonValue): ShippingModality[] {
  return jsonStringArray(value).filter((entry): entry is ShippingModality => {
    return entry === SHIPPING_MODALITY.HOME_DELIVERY || entry === SHIPPING_MODALITY.BRANCH_DELIVERY;
  });
}

function stringRecordValue(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Commerce money values must serialize to finite numbers.");
  return numberValue;
}

function toPaymentStatus(status: PaymentMethodStatus): PaymentStatus {
  return status === PaymentMethodStatus.ACTIVE ? PAYMENT_STATUS.ACTIVE : PAYMENT_STATUS.INACTIVE;
}

function toShippingProviderStatus(status: ShippingProviderStatus): ShippingProviderStatusValue {
  if (status === ShippingProviderStatus.ACTIVE) return SHIPPING_PROVIDER_STATUS.ACTIVE;
  if (status === ShippingProviderStatus.CONFIGURED_INACTIVE) return SHIPPING_PROVIDER_STATUS.CONFIGURED_INACTIVE;
  return SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED;
}

function toPickupPointStatus(status: PickupPointStatus): PickupPointStatusValue {
  if (status === PickupPointStatus.ACTIVE) return PICKUP_POINT_STATUS.ACTIVE;
  if (status === PickupPointStatus.CONFIGURED_INACTIVE) return PICKUP_POINT_STATUS.CONFIGURED_INACTIVE;
  return PICKUP_POINT_STATUS.NOT_CONFIGURED;
}

function toPickupCostType(costType: PickupCostType): PickupCostValue {
  return costType === PickupCostType.FIXED ? PICKUP_COST_TYPE.FIXED : PICKUP_COST_TYPE.FREE;
}

function toPickupCoverageType(coverageType: PickupCoverageType): PickupCoverageValue {
  return coverageType === PickupCoverageType.PROVINCES ? PICKUP_COVERAGE_TYPE.PROVINCES : PICKUP_COVERAGE_TYPE.ALL;
}

function toDiscountStatus(status: CouponStatus): DiscountStatus {
  return status === CouponStatus.ACTIVE ? DISCOUNT_STATUS.ACTIVE : DISCOUNT_STATUS.INACTIVE;
}

function toCouponDiscountType(type: CouponDiscountType): CouponDiscountValue {
  if (type === CouponDiscountType.FIXED) return COUPON_DISCOUNT_TYPE.FIXED;
  if (type === CouponDiscountType.FREE_SHIPPING) return COUPON_DISCOUNT_TYPE.FREE_SHIPPING;
  return COUPON_DISCOUNT_TYPE.PERCENTAGE;
}

function toCouponTargetType(type: CouponTargetType): CouponTargetValue {
  if (type === CouponTargetType.CATEGORIES) return COUPON_TARGET_TYPE.CATEGORIES;
  if (type === CouponTargetType.PRODUCTS) return COUPON_TARGET_TYPE.PRODUCTS;
  return COUPON_TARGET_TYPE.ALL_STORE;
}

function toCouponUsageLimitType(type: CouponUsageLimitType): CouponUsageLimitValue {
  return type === CouponUsageLimitType.LIMITED ? COUPON_USAGE_LIMIT_TYPE.LIMITED : COUPON_USAGE_LIMIT_TYPE.UNLIMITED;
}

function toCouponCustomerLimitType(type: CouponCustomerLimitType): CouponCustomerLimitValue {
  if (type === CouponCustomerLimitType.LIMITED) return COUPON_CUSTOMER_LIMIT_TYPE.LIMITED;
  if (type === CouponCustomerLimitType.FIRST_PURCHASE) return COUPON_CUSTOMER_LIMIT_TYPE.FIRST_PURCHASE;
  return COUPON_CUSTOMER_LIMIT_TYPE.UNLIMITED;
}

function toCouponDateLimitType(type: CouponDateLimitType): CouponDateLimitValue {
  return type === CouponDateLimitType.PERIOD ? COUPON_DATE_LIMIT_TYPE.PERIOD : COUPON_DATE_LIMIT_TYPE.UNLIMITED;
}

function toCouponMaxDiscountType(type: CouponMaxDiscountType): CouponMaxDiscountValue {
  return type === CouponMaxDiscountType.AMOUNT ? COUPON_MAX_DISCOUNT_TYPE.AMOUNT : COUPON_MAX_DISCOUNT_TYPE.NONE;
}

function toCouponHistoryAction(action: CouponHistoryAction): CouponHistoryActionValue {
  if (action === CouponHistoryAction.ACTIVATED) return COUPON_HISTORY_ACTION.ACTIVATED;
  if (action === CouponHistoryAction.DEACTIVATED) return COUPON_HISTORY_ACTION.DEACTIVATED;
  if (action === CouponHistoryAction.UPDATED) return COUPON_HISTORY_ACTION.UPDATED;
  return COUPON_HISTORY_ACTION.CREATED;
}

function couponHistoryLabel(action: CouponHistoryActionValue): string {
  if (action === COUPON_HISTORY_ACTION.ACTIVATED) return "Cupón activado";
  if (action === COUPON_HISTORY_ACTION.DEACTIVATED) return "Cupón desactivado";
  if (action === COUPON_HISTORY_ACTION.UPDATED) return "Cupón editado";
  return "Cupón creado";
}

function toShippingDiscountTargetType(type: ShippingDiscountTargetType): ShippingDiscountTargetValue {
  return type === ShippingDiscountTargetType.CATEGORIES
    ? SHIPPING_DISCOUNT_TARGET_TYPE.CATEGORIES
    : SHIPPING_DISCOUNT_TARGET_TYPE.ALL_STORE;
}

function toShippingZoneTargetType(type: ShippingZoneTargetType): ShippingZoneTargetValue {
  return type === ShippingZoneTargetType.SPECIFIC ? SHIPPING_ZONE_TARGET_TYPE.SPECIFIC : SHIPPING_ZONE_TARGET_TYPE.ALL;
}
