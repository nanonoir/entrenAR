import type { AdminSale, SaleAddress, SaleShippingStatus } from "@/types/sales";

export const SHIPPING_PROVIDER_ID = { ANDREANI: "andreani", CORREO_ARGENTINO: "correo-argentino" } as const;
export type ShippingProviderId = (typeof SHIPPING_PROVIDER_ID)[keyof typeof SHIPPING_PROVIDER_ID];

export const SHIPPING_CONFIG_STATUS = { NOT_CONFIGURED: "not_configured", CONFIGURED_INACTIVE: "configured_inactive", ACTIVE: "active" } as const;
export type ShippingConfigStatus = (typeof SHIPPING_CONFIG_STATUS)[keyof typeof SHIPPING_CONFIG_STATUS];

export const SHIPPING_MODALITY = { HOME_DELIVERY: "home_delivery", BRANCH_DELIVERY: "branch_delivery" } as const;
export type ShippingModality = (typeof SHIPPING_MODALITY)[keyof typeof SHIPPING_MODALITY];

export const PICKUP_COST_TYPE = { FREE: "free", FIXED: "fixed" } as const;
export type PickupCostType = (typeof PICKUP_COST_TYPE)[keyof typeof PICKUP_COST_TYPE];

export const PICKUP_COVERAGE_TYPE = { ALL: "all", PROVINCES: "provinces" } as const;
export type PickupCoverageType = (typeof PICKUP_COVERAGE_TYPE)[keyof typeof PICKUP_COVERAGE_TYPE];

export interface WeightRange {
  id: string;
  minGrams: number;
  maxGrams: number;
  cost: number;
}

export interface ShippingOrigin {
  senderName: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface ShippingProviderConfig {
  id: ShippingProviderId;
  name: string;
  status: ShippingConfigStatus;
  enabledModalities: ShippingModality[];
  origin: ShippingOrigin;
  weightRanges: WeightRange[];
  freeShippingThreshold?: number;
  updatedAt?: string;
}

export interface PickupScheduleRange {
  id: string;
  day: string;
  from: string;
  to: string;
}

export interface PickupPointAddress {
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  status: ShippingConfigStatus;
  isMain: boolean;
  address: PickupPointAddress;
  contactName?: string;
  contactPhone?: string;
  schedule: PickupScheduleRange[];
  preparationHours: number;
  costType: PickupCostType;
  fixedCost?: number;
  coverageType: PickupCoverageType;
  provinces: string[];
  updatedAt?: string;
}

export interface ShippingProviderDefinition {
  id: ShippingProviderId;
  name: string;
  services: string[];
}

export const SHIPMENT_DELIVERY_TYPE = { HOME_DELIVERY: "home_delivery", BRANCH_DELIVERY: "branch_delivery", PICKUP: "pickup", MANUAL: "manual" } as const;
export type ShipmentDeliveryType = (typeof SHIPMENT_DELIVERY_TYPE)[keyof typeof SHIPMENT_DELIVERY_TYPE];

export interface ShipmentTrackingRecord {
  id: string;
  saleId: string;
  saleNumber: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  address?: SaleAddress;
  deliveryType: ShipmentDeliveryType;
  status: SaleShippingStatus;
  paymentStatus: AdminSale["paymentStatus"];
  trackingCode?: string;
  providerName: string;
  source?: string;
  shippingCost: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  products: AdminSale["products"];
  logisticsSummary: string;
}
