"use client";

import { create } from "zustand";
import type { Coupon, CouponHistoryAction, CouponHistoryItem, ShippingDiscount } from "@/lib/data/admin/discounts/types";
import type { CouponFormValues, ShippingDiscountFormValues } from "@/schemas/admin/discount-schemas";

type AdminDiscountsState = {
  coupons: Coupon[];
  shippingDiscounts: ShippingDiscount[];
  createCoupon: (input: CouponFormValues) => Coupon;
  updateCoupon: (id: string, input: CouponFormValues) => void;
  deleteCoupon: (id: string) => void;
  activateCoupon: (id: string) => void;
  deactivateCoupon: (id: string) => void;
  createShippingDiscount: (input: ShippingDiscountFormValues) => ShippingDiscount;
  updateShippingDiscount: (id: string, input: ShippingDiscountFormValues) => void;
  deleteShippingDiscount: (id: string) => void;
  activateShippingDiscount: (id: string) => void;
  deactivateShippingDiscount: (id: string) => void;
};

const actorName = "Equipo EntrenAR";

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function historyItem(action: CouponHistoryAction, createdAt = now()): CouponHistoryItem {
  const labels: Record<CouponHistoryAction, string> = {
    created: "Cupón creado",
    activated: "Cupón activado",
    deactivated: "Cupón desactivado",
    updated: "Cupón editado",
  };

  return { id: createId("coupon-history"), action, label: labels[action], userName: actorName, createdAt };
}

function createCouponFromInput(input: CouponFormValues): Coupon {
  const createdAt = now();
  return {
    id: createId("coupon"),
    ...input,
    usageCount: 0,
    createdAt,
    updatedAt: createdAt,
    history: [historyItem("created", createdAt)],
  };
}

function createShippingDiscountFromInput(input: ShippingDiscountFormValues): ShippingDiscount {
  const createdAt = now();
  return { id: createId("shipping-discount"), ...input, createdAt, updatedAt: createdAt };
}

export const useAdminDiscountsStore = create<AdminDiscountsState>()((set) => ({
  coupons: [],
  shippingDiscounts: [],

  createCoupon: (input) => {
    const coupon = createCouponFromInput(input);
    set((state) => ({ coupons: [...state.coupons, coupon] }));
    return coupon;
  },
  updateCoupon: (id, input) => set((state) => ({
    coupons: state.coupons.map((coupon) =>
      coupon.id === id ? { ...coupon, ...input, updatedAt: now(), history: [...coupon.history, historyItem("updated")] } : coupon,
    ),
  })),
  deleteCoupon: (id) => set((state) => ({ coupons: state.coupons.filter((coupon) => coupon.id !== id) })),
  activateCoupon: (id) => set((state) => ({
    coupons: state.coupons.map((coupon) =>
      coupon.id === id && coupon.status !== "active" ? { ...coupon, status: "active", updatedAt: now(), history: [...coupon.history, historyItem("activated")] } : coupon,
    ),
  })),
  deactivateCoupon: (id) => set((state) => ({
    coupons: state.coupons.map((coupon) =>
      coupon.id === id && coupon.status !== "inactive" ? { ...coupon, status: "inactive", updatedAt: now(), history: [...coupon.history, historyItem("deactivated")] } : coupon,
    ),
  })),

  createShippingDiscount: (input) => {
    const shippingDiscount = createShippingDiscountFromInput(input);
    set((state) => ({ shippingDiscounts: [...state.shippingDiscounts, shippingDiscount] }));
    return shippingDiscount;
  },
  updateShippingDiscount: (id, input) => set((state) => ({
    shippingDiscounts: state.shippingDiscounts.map((discount) => (discount.id === id ? { ...discount, ...input, updatedAt: now() } : discount)),
  })),
  deleteShippingDiscount: (id) => set((state) => ({ shippingDiscounts: state.shippingDiscounts.filter((discount) => discount.id !== id) })),
  activateShippingDiscount: (id) => set((state) => ({
    shippingDiscounts: state.shippingDiscounts.map((discount) => (discount.id === id ? { ...discount, status: "active", updatedAt: now() } : discount)),
  })),
  deactivateShippingDiscount: (id) => set((state) => ({
    shippingDiscounts: state.shippingDiscounts.map((discount) => (discount.id === id ? { ...discount, status: "inactive", updatedAt: now() } : discount)),
  })),
}));
