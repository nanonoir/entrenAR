import { DATA_SOURCE, getCommerceDataSource, type DataSource } from "@/lib/api/config";
import { CommerceApiRepository } from "@/lib/api/commerce/api-commerce.repository";
import { MockCommerceRepository } from "@/lib/api/commerce/mock-commerce.repository";
import type {
  PaymentProviderDefinition,
  PaymentProviderId,
  PaymentProviderOption,
  PaymentStatus,
} from "@/lib/data/admin/payment-methods";
import type {
  PickupPoint as StaticPickupPoint,
  ShippingProviderConfig,
  WeightRange,
} from "@/lib/data/admin/shipping/shipping-config";
import type {
  Coupon as StaticCoupon,
  ShippingDiscount as StaticShippingDiscount,
} from "@/lib/data/admin/discounts/types";

export interface BankTransferConfig {
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
  holderName: string;
}

export type PaymentMethodConfig = PaymentProviderDefinition & {
  bankConfig?: BankTransferConfig;
  selectedOptionId?: string;
  status: PaymentStatus;
  updatedAt?: string;
};

export interface UpdatePaymentMethodDTO {
  bankConfig?: BankTransferConfig | null;
  selectedOptionId?: string | null;
  status: PaymentStatus;
}

export type PaymentMethodUpdateDTO = UpdatePaymentMethodDTO;

export interface ShippingOrigin {
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

export interface ShippingProvider extends Omit<ShippingProviderConfig, "origin" | "weightRanges"> {
  origin: ShippingOrigin;
  weightRanges: WeightRange[];
}

export type CommerceWeightBand = WeightRange;
export type WeightBand = CommerceWeightBand;

export type UpdateShippingProviderDTO = Omit<ShippingProvider, "id" | "name" | "updatedAt">;
export type ShippingProviderUpdateDTO = UpdateShippingProviderDTO;

export interface PickupAddress {
  city: string;
  number: string;
  postalCode: string;
  province: string;
  street: string;
}

export interface PickupScheduleRange {
  day: string;
  from: string;
  id: string;
  to: string;
}

export interface PickupPoint extends Omit<StaticPickupPoint, "address" | "schedule"> {
  address: PickupAddress;
  contactEmail?: string;
  schedule: PickupScheduleRange[];
}

export type UpdatePickupPointDTO = Omit<PickupPoint, "id" | "updatedAt">;
export type PickupPointUpdateDTO = UpdatePickupPointDTO;

export type Coupon = StaticCoupon;
export type CreateCouponDTO = Omit<Coupon, "createdAt" | "history" | "id" | "updatedAt" | "usageCount">;
export type UpdateCouponDTO = CreateCouponDTO;
export type CouponCreateDTO = CreateCouponDTO;
export type CouponUpdateDTO = UpdateCouponDTO;

export type ShippingDiscount = StaticShippingDiscount;
export type CreateShippingDiscountDTO = Omit<ShippingDiscount, "createdAt" | "id" | "updatedAt">;
export type UpdateShippingDiscountDTO = CreateShippingDiscountDTO;
export type ShippingDiscountCreateDTO = CreateShippingDiscountDTO;
export type ShippingDiscountUpdateDTO = UpdateShippingDiscountDTO;

export interface CommerceRepository {
  readonly source: DataSource;

  getPaymentMethods(): Promise<PaymentMethodConfig[]>;
  updatePaymentMethod(providerId: string, data: UpdatePaymentMethodDTO): Promise<PaymentMethodConfig>;

  getShippingProviders(): Promise<ShippingProvider[]>;
  updateShippingProvider(providerId: string, data: UpdateShippingProviderDTO): Promise<ShippingProvider>;

  getPickupPoints(): Promise<PickupPoint[]>;
  updatePickupPoint(id: string, data: UpdatePickupPointDTO): Promise<PickupPoint>;

  getCoupons(): Promise<Coupon[]>;
  createCoupon(data: CreateCouponDTO): Promise<Coupon>;
  updateCoupon(id: string, data: UpdateCouponDTO): Promise<Coupon>;
  deleteCoupon(id: string): Promise<void>;

  getShippingDiscounts(): Promise<ShippingDiscount[]>;
  createShippingDiscount(data: CreateShippingDiscountDTO): Promise<ShippingDiscount>;
  updateShippingDiscount(id: string, data: UpdateShippingDiscountDTO): Promise<ShippingDiscount>;
  deleteShippingDiscount(id: string): Promise<void>;
}

const mockCommerceRepository = new MockCommerceRepository();
const apiCommerceRepository = new CommerceApiRepository();

export function getCommerceRepository(source = getCommerceDataSource()): CommerceRepository {
  return source === DATA_SOURCE.API ? apiCommerceRepository : mockCommerceRepository;
}

export { DATA_SOURCE };
export type { DataSource, PaymentProviderId, PaymentProviderOption, PaymentStatus };
