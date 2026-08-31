"use client";

import { create } from "zustand";
import {
  DATA_SOURCE,
  getCommerceRepository,
  type UpdateCouponDTO,
  type UpdateShippingDiscountDTO,
} from "@/lib/api/commerce/commerce.repository";
import type { Coupon, CouponHistoryAction, CouponHistoryItem, ShippingDiscount } from "@/lib/data/admin/discounts/types";
import type { CouponFormValues, ShippingDiscountFormValues } from "@/schemas/admin/discount-schemas";
import {
  COMMERCE_ASYNC_STATUS,
  toCommerceStoreError,
  type CommerceAsyncStatus,
  type CommerceStoreError,
} from "@/stores/admin-commerce-state";

export type AdminDiscountsState = {
  activateCoupon: (id: string) => Promise<boolean>;
  activateShippingDiscount: (id: string) => Promise<boolean>;
  clearError: () => void;
  coupons: Coupon[];
  couponsEmpty: boolean;
  createCoupon: (input: CouponFormValues) => Coupon;
  createCouponAsync: (input: CouponFormValues) => Promise<Coupon | null>;
  createShippingDiscount: (input: ShippingDiscountFormValues) => ShippingDiscount;
  createShippingDiscountAsync: (input: ShippingDiscountFormValues) => Promise<ShippingDiscount | null>;
  deactivateCoupon: (id: string) => Promise<boolean>;
  deactivateShippingDiscount: (id: string) => Promise<boolean>;
  deleteCoupon: (id: string) => Promise<boolean>;
  deleteShippingDiscount: (id: string) => Promise<boolean>;
  error: CommerceStoreError | null;
  hasLoaded: boolean;
  isEmpty: boolean;
  load: () => Promise<boolean>;
  shippingDiscounts: ShippingDiscount[];
  shippingDiscountsEmpty: boolean;
  source: ReturnType<typeof getCommerceRepository>["source"];
  status: CommerceAsyncStatus;
  updateCoupon: (id: string, input: CouponFormValues) => Promise<boolean>;
  updateShippingDiscount: (id: string, input: ShippingDiscountFormValues) => Promise<boolean>;
};

const actorName = "Equipo EntrenAR";
let operationSequence = 0;
let idSequence = 0;

const configuredRepository = getCommerceRepository();
const initialSource = configuredRepository.source;

export const useAdminDiscountsStore = create<AdminDiscountsState>()((set, get) => ({
  activateCoupon: (id) => updateCouponStatus(id, "active", set, get),
  activateShippingDiscount: (id) => updateShippingDiscountStatus(id, "active", set, get),
  clearError: () => set((state) => ({
    error: null,
    status: state.hasLoaded ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,
  })),
  coupons: [],
  couponsEmpty: true,
  createCoupon: (input) => createCouponCompat(input, set, get),
  createCouponAsync: (input) => createCouponAsync(input, set),
  createShippingDiscount: (input) => createShippingDiscountCompat(input, set, get),
  createShippingDiscountAsync: (input) => createShippingDiscountAsync(input, set),
  deactivateCoupon: (id) => updateCouponStatus(id, "inactive", set, get),
  deactivateShippingDiscount: (id) => updateShippingDiscountStatus(id, "inactive", set, get),
  deleteCoupon: (id) => deleteCoupon(id, set, get),
  deleteShippingDiscount: (id) => deleteShippingDiscount(id, set, get),
  error: null,
  hasLoaded: initialSource === DATA_SOURCE.MOCK,
  isEmpty: true,
  load: () => loadDiscounts(set),
  shippingDiscounts: [],
  shippingDiscountsEmpty: true,
  source: initialSource,
  status: initialSource === DATA_SOURCE.MOCK ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,
  updateCoupon: (id, input) => updateCoupon(id, input, set, get),
  updateShippingDiscount: (id, input) => updateShippingDiscount(id, input, set, get),
}));

type DiscountsStoreSetter = (
  partial: Partial<AdminDiscountsState> | ((state: AdminDiscountsState) => Partial<AdminDiscountsState>),
) => void;

type DiscountsStoreGetter = () => AdminDiscountsState;

async function loadDiscounts(set: DiscountsStoreSetter): Promise<boolean> {
  const repository = getCommerceRepository();
  const operationId = ++operationSequence;
  set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });

  try {
    const [coupons, shippingDiscounts] = await Promise.all([
      repository.getCoupons(),
      repository.getShippingDiscounts(),
    ]);
    if (operationId !== operationSequence) return false;

    set({
      coupons,
      couponsEmpty: coupons.length === 0,
      error: null,
      hasLoaded: true,
      isEmpty: coupons.length === 0 && shippingDiscounts.length === 0,
      shippingDiscounts,
      shippingDiscountsEmpty: shippingDiscounts.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    });
    return true;
  } catch (error) {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "DISCOUNTS_LOAD_FAILED", "The discount configuration could not be loaded."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    return false;
  }
}

function createCouponCompat(
  input: CouponFormValues,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Coupon {
  const repository = getCommerceRepository();
  const previousCoupons = get().coupons;
  const provisional = createCouponFromInput(input);
  const operationId = ++operationSequence;

  set({
    coupons: [...previousCoupons, provisional],
    couponsEmpty: false,
    error: null,
    hasLoaded: true,
    isEmpty: false,
    source: repository.source,
    status: COMMERCE_ASYNC_STATUS.LOADING,
  });

  void repository.createCoupon(input).then((created) => {
    if (operationId !== operationSequence) return;

    set((state) => ({
      coupons: state.coupons.map((coupon) => coupon.id === provisional.id ? created : coupon),
      couponsEmpty: false,
      error: null,
      isEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return;

    set({
      coupons: previousCoupons,
      couponsEmpty: previousCoupons.length === 0,
      error: toCommerceStoreError(error, "COUPON_CREATE_FAILED", "The coupon could not be created."),
      isEmpty: previousCoupons.length === 0 && get().shippingDiscounts.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
  });

  return provisional;
}

async function createCouponAsync(
  input: CouponFormValues,
  set: DiscountsStoreSetter,
): Promise<Coupon | null> {
  const repository = getCommerceRepository();
  const operationId = ++operationSequence;
  set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });

  try {
    const created = await repository.createCoupon(input);
    if (operationId !== operationSequence) return null;

    set((state) => ({
      coupons: [...state.coupons, created],
      couponsEmpty: false,
      error: null,
      hasLoaded: true,
      isEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return created;
  } catch (error) {
    if (operationId !== operationSequence) return null;

    set({
      error: toCommerceStoreError(error, "COUPON_CREATE_FAILED", "The coupon could not be created."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    return null;
  }
}

function updateCoupon(
  id: string,
  input: CouponFormValues,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const current = get().coupons.find((coupon) => coupon.id === id);
  if (!current) return setMissingResourceError(set, "COUPON_NOT_FOUND", "The requested coupon is not loaded.");

  const repository = getCommerceRepository();
  const previousCoupons = get().coupons;
  const optimisticCoupon = {
    ...current,
    ...input,
    history: [...current.history, historyItem("updated")],
    updatedAt: now(),
  };
  const operationId = ++operationSequence;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      coupons: previousCoupons.map((coupon) => coupon.id === id ? optimisticCoupon : coupon),
      error: null,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.updateCoupon(id, input).then((updated) => {
    if (operationId !== operationSequence) return false;

    set((state) => ({
      coupons: state.coupons.map((coupon) => coupon.id === updated.id ? updated : coupon),
      couponsEmpty: false,
      error: null,
      hasLoaded: true,
      isEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "COUPON_UPDATE_FAILED", "The coupon could not be updated."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    if (repository.source === DATA_SOURCE.MOCK) set({ coupons: previousCoupons });
    return false;
  });
}

function updateCouponStatus(
  id: string,
  status: Coupon["status"],
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const coupon = get().coupons.find((current) => current.id === id);
  if (!coupon) return setMissingResourceError(set, "COUPON_NOT_FOUND", "The requested coupon is not loaded.");
  if (coupon.status === status) return Promise.resolve(true);

  return updateCoupon(id, toCouponInput(coupon, status), set, get);
}

function deleteCoupon(
  id: string,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const previousCoupons = get().coupons;
  if (!previousCoupons.some((coupon) => coupon.id === id)) {
    return setMissingResourceError(set, "COUPON_NOT_FOUND", "The requested coupon is not loaded.");
  }

  const repository = getCommerceRepository();
  const nextCoupons = previousCoupons.filter((coupon) => coupon.id !== id);
  const operationId = ++operationSequence;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      coupons: nextCoupons,
      couponsEmpty: nextCoupons.length === 0,
      error: null,
      isEmpty: nextCoupons.length === 0 && get().shippingDiscounts.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.deleteCoupon(id).then(() => {
    if (operationId !== operationSequence) return false;

    set((state) => {
      const coupons = state.coupons.filter((coupon) => coupon.id !== id);
      return {
        coupons,
        couponsEmpty: coupons.length === 0,
        error: null,
        hasLoaded: true,
        isEmpty: coupons.length === 0 && state.shippingDiscounts.length === 0,
        source: repository.source,
        status: COMMERCE_ASYNC_STATUS.SUCCESS,
      };
    });
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "COUPON_DELETE_FAILED", "The coupon could not be deleted."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    if (repository.source === DATA_SOURCE.MOCK) set({ coupons: previousCoupons, couponsEmpty: false, isEmpty: false });
    return false;
  });
}

function createShippingDiscountCompat(
  input: ShippingDiscountFormValues,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): ShippingDiscount {
  const repository = getCommerceRepository();
  const previousShippingDiscounts = get().shippingDiscounts;
  const provisional = createShippingDiscountFromInput(input);
  const operationId = ++operationSequence;

  set({
    error: null,
    hasLoaded: true,
    isEmpty: false,
    shippingDiscounts: [...previousShippingDiscounts, provisional],
    shippingDiscountsEmpty: false,
    source: repository.source,
    status: COMMERCE_ASYNC_STATUS.LOADING,
  });

  void repository.createShippingDiscount(input).then((created) => {
    if (operationId !== operationSequence) return;

    set((state) => ({
      error: null,
      isEmpty: false,
      shippingDiscounts: state.shippingDiscounts.map((discount) => discount.id === provisional.id ? created : discount),
      shippingDiscountsEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return;

    set({
      error: toCommerceStoreError(error, "SHIPPING_DISCOUNT_CREATE_FAILED", "The shipping discount could not be created."),
      isEmpty: get().coupons.length === 0 && previousShippingDiscounts.length === 0,
      shippingDiscounts: previousShippingDiscounts,
      shippingDiscountsEmpty: previousShippingDiscounts.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
  });

  return provisional;
}

async function createShippingDiscountAsync(
  input: ShippingDiscountFormValues,
  set: DiscountsStoreSetter,
): Promise<ShippingDiscount | null> {
  const repository = getCommerceRepository();
  const operationId = ++operationSequence;
  set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });

  try {
    const created = await repository.createShippingDiscount(input);
    if (operationId !== operationSequence) return null;

    set((state) => ({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      shippingDiscounts: [...state.shippingDiscounts, created],
      shippingDiscountsEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return created;
  } catch (error) {
    if (operationId !== operationSequence) return null;

    set({
      error: toCommerceStoreError(error, "SHIPPING_DISCOUNT_CREATE_FAILED", "The shipping discount could not be created."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    return null;
  }
}

function updateShippingDiscount(
  id: string,
  input: ShippingDiscountFormValues,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const current = get().shippingDiscounts.find((discount) => discount.id === id);
  if (!current) return setMissingResourceError(set, "SHIPPING_DISCOUNT_NOT_FOUND", "The requested shipping discount is not loaded.");

  const repository = getCommerceRepository();
  const previousShippingDiscounts = get().shippingDiscounts;
  const optimisticDiscount = { ...current, ...input, updatedAt: now() };
  const operationId = ++operationSequence;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      error: null,
      shippingDiscounts: previousShippingDiscounts.map((discount) => discount.id === id ? optimisticDiscount : discount),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.updateShippingDiscount(id, input).then((updated) => {
    if (operationId !== operationSequence) return false;

    set((state) => ({
      error: null,
      hasLoaded: true,
      isEmpty: state.coupons.length === 0 && state.shippingDiscounts.length === 0,
      shippingDiscounts: state.shippingDiscounts.map((discount) => discount.id === updated.id ? updated : discount),
      shippingDiscountsEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "SHIPPING_DISCOUNT_UPDATE_FAILED", "The shipping discount could not be updated."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    if (repository.source === DATA_SOURCE.MOCK) set({ shippingDiscounts: previousShippingDiscounts });
    return false;
  });
}

function updateShippingDiscountStatus(
  id: string,
  status: ShippingDiscount["status"],
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const discount = get().shippingDiscounts.find((current) => current.id === id);
  if (!discount) return setMissingResourceError(set, "SHIPPING_DISCOUNT_NOT_FOUND", "The requested shipping discount is not loaded.");
  if (discount.status === status) return Promise.resolve(true);

  return updateShippingDiscount(id, toShippingDiscountInput(discount, status), set, get);
}

function deleteShippingDiscount(
  id: string,
  set: DiscountsStoreSetter,
  get: DiscountsStoreGetter,
): Promise<boolean> {
  const previousShippingDiscounts = get().shippingDiscounts;
  if (!previousShippingDiscounts.some((discount) => discount.id === id)) {
    return setMissingResourceError(set, "SHIPPING_DISCOUNT_NOT_FOUND", "The requested shipping discount is not loaded.");
  }

  const repository = getCommerceRepository();
  const nextShippingDiscounts = previousShippingDiscounts.filter((discount) => discount.id !== id);
  const operationId = ++operationSequence;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      error: null,
      isEmpty: get().coupons.length === 0 && nextShippingDiscounts.length === 0,
      shippingDiscounts: nextShippingDiscounts,
      shippingDiscountsEmpty: nextShippingDiscounts.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.deleteShippingDiscount(id).then(() => {
    if (operationId !== operationSequence) return false;

    set((state) => {
      const shippingDiscounts = state.shippingDiscounts.filter((discount) => discount.id !== id);
      return {
        error: null,
        hasLoaded: true,
        isEmpty: state.coupons.length === 0 && shippingDiscounts.length === 0,
        shippingDiscounts,
        shippingDiscountsEmpty: shippingDiscounts.length === 0,
        source: repository.source,
        status: COMMERCE_ASYNC_STATUS.SUCCESS,
      };
    });
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "SHIPPING_DISCOUNT_DELETE_FAILED", "The shipping discount could not be deleted."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    if (repository.source === DATA_SOURCE.MOCK) {
      set({
        isEmpty: get().coupons.length === 0 && previousShippingDiscounts.length === 0,
        shippingDiscounts: previousShippingDiscounts,
        shippingDiscountsEmpty: false,
      });
    }
    return false;
  });
}

function toCouponInput(coupon: Coupon, status: Coupon["status"]): UpdateCouponDTO {
  return {
    canCombineWithPromotions: coupon.canCombineWithPromotions,
    categoryIds: [...coupon.categoryIds],
    code: coupon.code,
    customerLimitType: coupon.customerLimitType,
    ...(coupon.customerUsageLimit === undefined ? {} : { customerUsageLimit: coupon.customerUsageLimit }),
    dateLimitType: coupon.dateLimitType,
    discountType: coupon.discountType,
    ...(coupon.discountValue === undefined ? {} : { discountValue: coupon.discountValue }),
    ...(coupon.endDate === undefined ? {} : { endDate: coupon.endDate }),
    includeShippingCost: coupon.includeShippingCost,
    ...(coupon.maxDiscountAmount === undefined ? {} : { maxDiscountAmount: coupon.maxDiscountAmount }),
    maxDiscountType: coupon.maxDiscountType,
    minimumCartAmount: coupon.minimumCartAmount,
    productIds: [...coupon.productIds],
    ...(coupon.startDate === undefined ? {} : { startDate: coupon.startDate }),
    status,
    targetType: coupon.targetType,
    ...(coupon.totalUsageLimit === undefined ? {} : { totalUsageLimit: coupon.totalUsageLimit }),
    totalUsageLimitType: coupon.totalUsageLimitType,
  };
}

function toShippingDiscountInput(discount: ShippingDiscount, status: ShippingDiscount["status"]): UpdateShippingDiscountDTO {
  return {
    canCombineWithPromotions: discount.canCombineWithPromotions,
    categoryIds: [...discount.categoryIds],
    minimumCartAmount: discount.minimumCartAmount,
    onlyCheapestShippingMethod: discount.onlyCheapestShippingMethod,
    shippingMethodIds: [...discount.shippingMethodIds],
    status,
    targetType: discount.targetType,
    zoneIds: [...discount.zoneIds],
    zoneTargetType: discount.zoneTargetType,
  };
}

function setMissingResourceError(
  set: DiscountsStoreSetter,
  code: string,
  message: string,
): Promise<boolean> {
  set({
    error: toCommerceStoreError(new Error(message), code, message),
    status: COMMERCE_ASYNC_STATUS.ERROR,
  });
  return Promise.resolve(false);
}

function createCouponFromInput(input: CouponFormValues): Coupon {
  const createdAt = now();
  return {
    id: createId("coupon"),
    ...input,
    createdAt,
    history: [historyItem("created", createdAt)],
    updatedAt: createdAt,
    usageCount: 0,
  };
}

function createShippingDiscountFromInput(input: ShippingDiscountFormValues): ShippingDiscount {
  const createdAt = now();
  return { ...input, createdAt, id: createId("shipping-discount"), updatedAt: createdAt };
}

function historyItem(action: CouponHistoryAction, createdAt = now()): CouponHistoryItem {
  const labels: Record<CouponHistoryAction, string> = {
    activated: "Cupón activado",
    created: "Cupón creado",
    deactivated: "Cupón desactivado",
    updated: "Cupón editado",
  };

  return { action, createdAt, id: createId("coupon-history"), label: labels[action], userName: actorName };
}

function createId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++idSequence}`;
  return `${prefix}-${suffix}`;
}

function now(): string {
  return new Date().toISOString();
}
