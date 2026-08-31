import { CommerceApiError } from "@/lib/api/commerce/client";
import type {
  CommerceRepository,
  Coupon,
  CreateCouponDTO,
  CreateShippingDiscountDTO,
  PaymentMethodConfig,
  PickupPoint,
  ShippingDiscount,
  ShippingProvider,
  UpdateCouponDTO,
  UpdatePaymentMethodDTO,
  UpdateShippingDiscountDTO,
  UpdateShippingProviderDTO,
  UpdatePickupPointDTO,
} from "@/lib/api/commerce/commerce.repository";
import { getPaymentProviderDefinitions } from "@/lib/data/admin/payment-methods";
import { initialPickupPoints, initialShippingProviders } from "@/lib/data/admin/shipping/shipping-config";
import type { CouponHistoryAction, CouponHistoryItem } from "@/lib/data/admin/discounts/types";
import { DATA_SOURCE } from "@/lib/api/config";

const MOCK_ACTOR_NAME = "Equipo EntrenAR";
let idSequence = 0;

export class MockCommerceRepository implements CommerceRepository {
  readonly source = DATA_SOURCE.MOCK;

  private readonly paymentMethods: Promise<PaymentMethodConfig[]> = getPaymentProviderDefinitions().then((definitions) => definitions.map((definition) => ({
    ...definition,
    acceptedMethods: [...definition.acceptedMethods],
    options: definition.options.map((option) => ({ ...option })),
    status: "inactive" as const,
  })));

  private shippingProviders: ShippingProvider[] = initialShippingProviders.map(cloneShippingProvider);
  private pickupPoints: PickupPoint[] = initialPickupPoints.map(clonePickupPoint);
  private coupons: Coupon[] = [];
  private shippingDiscounts: ShippingDiscount[] = [];

  async getPaymentMethods(): Promise<PaymentMethodConfig[]> {
    return (await this.paymentMethods).map(clonePaymentMethod);
  }

  async updatePaymentMethod(providerId: string, input: UpdatePaymentMethodDTO): Promise<PaymentMethodConfig> {
    const methods = await this.paymentMethods;
    const current = methods.find((method) => method.id === providerId);
    if (!current) throw notFound("The requested payment method was not found.");

    const updated: PaymentMethodConfig = {
      ...current,
      selectedOptionId: input.selectedOptionId === undefined
        ? current.selectedOptionId
        : input.selectedOptionId ?? undefined,
      status: input.status,
      updatedAt: now(),
    };

    if (providerId === "bank-transfer") {
      if (input.bankConfig !== undefined) updated.bankConfig = input.bankConfig ?? undefined;
    } else {
      delete updated.bankConfig;
    }

    const index = methods.findIndex((method) => method.id === providerId);
    methods[index] = updated;
    return clonePaymentMethod(updated);
  }

  async getShippingProviders(): Promise<ShippingProvider[]> {
    return this.shippingProviders.map(cloneShippingProvider);
  }

  async updateShippingProvider(providerId: string, input: UpdateShippingProviderDTO): Promise<ShippingProvider> {
    const current = this.shippingProviders.find((provider) => provider.id === providerId);
    if (!current) throw notFound("The requested shipping provider was not found.");

    const updated: ShippingProvider = {
      ...current,
      ...input,
      id: current.id,
      name: current.name,
      origin: { ...input.origin },
      updatedAt: now(),
      weightRanges: input.weightRanges.map((range) => ({ ...range })),
    };
    this.shippingProviders = this.shippingProviders.map((provider) => provider.id === providerId ? updated : provider);
    return cloneShippingProvider(updated);
  }

  async getPickupPoints(): Promise<PickupPoint[]> {
    return this.pickupPoints.map(clonePickupPoint);
  }

  async updatePickupPoint(id: string, input: UpdatePickupPointDTO): Promise<PickupPoint> {
    const current = this.pickupPoints.find((point) => point.id === id);
    if (!current) throw notFound("The requested pickup point was not found.");

    const updated: PickupPoint = {
      ...current,
      ...input,
      address: { ...input.address },
      id: current.id,
      provinces: [...input.provinces],
      schedule: input.schedule.map((range) => ({ ...range })),
      updatedAt: now(),
    };
    this.pickupPoints = this.pickupPoints.map((point) => point.id === id ? updated : point);
    return clonePickupPoint(updated);
  }

  async getCoupons(): Promise<Coupon[]> {
    return this.coupons.map(cloneCoupon);
  }

  async createCoupon(input: CreateCouponDTO): Promise<Coupon> {
    const code = normalizeCouponCode(input.code);
    if (this.coupons.some((coupon) => coupon.code === code && coupon.status === "active")) {
      throw new CommerceApiError({
        code: "COUPON_CODE_ALREADY_EXISTS",
        message: "An active coupon with this code already exists.",
        status: 409,
      });
    }

    const createdAt = now();
    const coupon: Coupon = {
      ...input,
      code,
      createdAt,
      history: [historyItem("created", createdAt)],
      id: createId("coupon"),
      updatedAt: createdAt,
      usageCount: 0,
    };
    this.coupons = [...this.coupons, coupon];
    return cloneCoupon(coupon);
  }

  async updateCoupon(id: string, input: UpdateCouponDTO): Promise<Coupon> {
    const current = this.coupons.find((coupon) => coupon.id === id);
    if (!current) throw notFound("The requested coupon was not found.");

    const code = normalizeCouponCode(input.code);
    if (this.coupons.some((coupon) => coupon.id !== id && coupon.code === code && coupon.status === "active")) {
      throw new CommerceApiError({
        code: "COUPON_CODE_ALREADY_EXISTS",
        message: "An active coupon with this code already exists.",
        status: 409,
      });
    }

    const updatedAt = now();
    const action: CouponHistoryAction = current.status === "active" && input.status === "inactive"
      ? "deactivated"
      : current.status === "inactive" && input.status === "active"
        ? "activated"
        : "updated";
    const updated: Coupon = {
      ...current,
      ...input,
      code,
      history: [...current.history, historyItem(action, updatedAt)],
      updatedAt,
    };
    this.coupons = this.coupons.map((coupon) => coupon.id === id ? updated : coupon);
    return cloneCoupon(updated);
  }

  async deleteCoupon(id: string): Promise<void> {
    const next = this.coupons.filter((coupon) => coupon.id !== id);
    if (next.length === this.coupons.length) throw notFound("The requested coupon was not found.");
    this.coupons = next;
  }

  async getShippingDiscounts(): Promise<ShippingDiscount[]> {
    return this.shippingDiscounts.map(cloneShippingDiscount);
  }

  async createShippingDiscount(input: CreateShippingDiscountDTO): Promise<ShippingDiscount> {
    const createdAt = now();
    const discount: ShippingDiscount = {
      ...input,
      createdAt,
      id: createId("shipping-discount"),
      updatedAt: createdAt,
    };
    this.shippingDiscounts = [...this.shippingDiscounts, discount];
    return cloneShippingDiscount(discount);
  }

  async updateShippingDiscount(id: string, input: UpdateShippingDiscountDTO): Promise<ShippingDiscount> {
    const current = this.shippingDiscounts.find((discount) => discount.id === id);
    if (!current) throw notFound("The requested shipping discount was not found.");

    const updated: ShippingDiscount = {
      ...current,
      ...input,
      updatedAt: now(),
    };
    this.shippingDiscounts = this.shippingDiscounts.map((discount) => discount.id === id ? updated : discount);
    return cloneShippingDiscount(updated);
  }

  async deleteShippingDiscount(id: string): Promise<void> {
    const next = this.shippingDiscounts.filter((discount) => discount.id !== id);
    if (next.length === this.shippingDiscounts.length) throw notFound("The requested shipping discount was not found.");
    this.shippingDiscounts = next;
  }
}

function clonePaymentMethod(method: PaymentMethodConfig): PaymentMethodConfig {
  return {
    ...method,
    acceptedMethods: [...method.acceptedMethods],
    ...(method.bankConfig ? { bankConfig: { ...method.bankConfig } } : {}),
    options: method.options.map((option) => ({ ...option })),
  };
}

function cloneShippingProvider(provider: ShippingProvider): ShippingProvider {
  return {
    ...provider,
    enabledModalities: [...provider.enabledModalities],
    origin: { ...provider.origin },
    weightRanges: provider.weightRanges.map((range) => ({ ...range })),
  };
}

function clonePickupPoint(point: PickupPoint): PickupPoint {
  return {
    ...point,
    address: { ...point.address },
    provinces: [...point.provinces],
    schedule: point.schedule.map((range) => ({ ...range })),
  };
}

function cloneCoupon(coupon: Coupon): Coupon {
  return {
    ...coupon,
    categoryIds: [...coupon.categoryIds],
    history: coupon.history.map((item) => ({ ...item })),
    productIds: [...coupon.productIds],
  };
}

function cloneShippingDiscount(discount: ShippingDiscount): ShippingDiscount {
  return {
    ...discount,
    categoryIds: [...discount.categoryIds],
    shippingMethodIds: [...discount.shippingMethodIds],
    zoneIds: [...discount.zoneIds],
  };
}

function historyItem(action: CouponHistoryAction, createdAt: string): CouponHistoryItem {
  const labels: Record<CouponHistoryAction, string> = {
    activated: "Cupón activado",
    created: "Cupón creado",
    deactivated: "Cupón desactivado",
    updated: "Cupón editado",
  };

  return { action, createdAt, id: createId("coupon-history"), label: labels[action], userName: MOCK_ACTOR_NAME };
}

function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase();
}

function createId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++idSequence}`;
  return `${prefix}-${suffix}`;
}

function now(): string {
  return new Date().toISOString();
}

function notFound(message: string): CommerceApiError {
  return new CommerceApiError({ code: "NOT_FOUND", message, status: 404 });
}
