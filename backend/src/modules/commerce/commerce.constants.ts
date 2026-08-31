export const PAYMENT_PROVIDER = {
  BANK_TRANSFER: "bank-transfer",
  MERCADO_PAGO: "mercado-pago",
  PAYWAY: "payway",
  STRIPE: "stripe",
} as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

export const PAYMENT_PROVIDER_IDS = [
  PAYMENT_PROVIDER.BANK_TRANSFER,
  PAYMENT_PROVIDER.MERCADO_PAGO,
  PAYMENT_PROVIDER.STRIPE,
  PAYMENT_PROVIDER.PAYWAY,
] as const;

export const PAYMENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export interface PaymentProviderOptionDefinition {
  fee: string;
  id: string;
  receiveIn: string;
  salesIn: string;
}

export interface PaymentProviderDefinition {
  acceptedMethods: readonly string[];
  description: string;
  id: PaymentProviderId;
  logoSrc: string;
  name: string;
  options: readonly PaymentProviderOptionDefinition[];
}

export const PAYMENT_PROVIDER_DEFINITIONS: readonly PaymentProviderDefinition[] = [
  {
    acceptedMethods: ["Transferencia bancaria"],
    description: "Recibí pagos directos en una cuenta bancaria o billetera virtual.",
    id: PAYMENT_PROVIDER.BANK_TRANSFER,
    logoSrc: "/transfer.svg",
    name: "Transferencia Bancaria",
    options: [{ fee: "0%", id: "direct-transfer", receiveIn: "En el momento", salesIn: "En el momento" }],
  },
  {
    acceptedMethods: ["Billetera virtual", "Tarjeta de débito", "Tarjeta de crédito", "Pago en efectivo / redes de cobranza"],
    description: "Cobranzas con dinero en cuenta, tarjetas y medios de pago locales.",
    id: PAYMENT_PROVIDER.MERCADO_PAGO,
    logoSrc: "/mercadoPago.svg",
    name: "Mercado Pago",
    options: [
      { fee: "6.29%", id: "mp-instant", receiveIn: "En el momento", salesIn: "En el momento" },
      { fee: "4.39%", id: "mp-10-days", receiveIn: "10 días", salesIn: "10 días" },
      { fee: "3.39%", id: "mp-18-days", receiveIn: "18 días", salesIn: "18 días" },
    ],
  },
  {
    acceptedMethods: ["Tarjetas internacionales"],
    description: "Procesamiento internacional para tarjetas y billeteras compatibles.",
    id: PAYMENT_PROVIDER.STRIPE,
    logoSrc: "/stripeLogo.svg",
    name: "Stripe",
    options: [{ fee: "2.9% + USD0.30", id: "stripe-eea-standard", receiveIn: "En el momento", salesIn: "En el momento" }],
  },
  {
    acceptedMethods: ["Tarjetas de crédito", "Tarjetas de débito", "Tarjetas prepagas", "QR", "Billeteras virtuales"],
    description: "Cobros con tarjetas locales y acreditación configurable.",
    id: PAYMENT_PROVIDER.PAYWAY,
    logoSrc: "/payway.svg",
    name: "Payway",
    options: [
      { fee: "1.20% + IVA", id: "payway-debit", receiveIn: "En el momento", salesIn: "En el momento" },
      { fee: "6.30% + IVA", id: "payway-credit-instant", receiveIn: "En el momento (crédito)", salesIn: "En el momento (crédito)" },
      { fee: "2.00% + IVA", id: "payway-credit-8-business-days", receiveIn: "Crédito a 8 días hábiles", salesIn: "Crédito a 8 días hábiles" },
    ],
  },
];

export const SHIPPING_PROVIDER = {
  ANDREANI: "andreani",
  CORREO_ARGENTINO: "correo-argentino",
} as const;

export type ShippingProviderId = (typeof SHIPPING_PROVIDER)[keyof typeof SHIPPING_PROVIDER];

export const SHIPPING_PROVIDER_STATUS = {
  ACTIVE: "active",
  CONFIGURED_INACTIVE: "configured_inactive",
  NOT_CONFIGURED: "not_configured",
} as const;

export type ShippingProviderStatus = (typeof SHIPPING_PROVIDER_STATUS)[keyof typeof SHIPPING_PROVIDER_STATUS];

export const SHIPPING_MODALITY = {
  BRANCH_DELIVERY: "branch_delivery",
  HOME_DELIVERY: "home_delivery",
} as const;

export type ShippingModality = (typeof SHIPPING_MODALITY)[keyof typeof SHIPPING_MODALITY];

export interface ShippingProviderDefinition {
  id: ShippingProviderId;
  name: string;
  services: readonly ShippingServiceDefinition[];
}

export interface ShippingServiceDefinition {
  id: string;
  label: string;
  modality: ShippingModality;
  providerId: ShippingProviderId;
}

export const SHIPPING_PROVIDER_DEFINITIONS: readonly ShippingProviderDefinition[] = [
  {
    id: SHIPPING_PROVIDER.ANDREANI,
    name: "Andreani",
    services: [
      { id: "andreani:envío-a-domicilio", label: "Envío a domicilio", modality: SHIPPING_MODALITY.HOME_DELIVERY, providerId: SHIPPING_PROVIDER.ANDREANI },
      { id: "andreani:envío-a-sucursal", label: "Envío a sucursal", modality: SHIPPING_MODALITY.BRANCH_DELIVERY, providerId: SHIPPING_PROVIDER.ANDREANI },
    ],
  },
  {
    id: SHIPPING_PROVIDER.CORREO_ARGENTINO,
    name: "Correo Argentino",
    services: [
      { id: "correo-argentino:paquetería-nacional", label: "Paquetería nacional", modality: SHIPPING_MODALITY.HOME_DELIVERY, providerId: SHIPPING_PROVIDER.CORREO_ARGENTINO },
      { id: "correo-argentino:retiro-en-sucursal", label: "Retiro en sucursal", modality: SHIPPING_MODALITY.BRANCH_DELIVERY, providerId: SHIPPING_PROVIDER.CORREO_ARGENTINO },
    ],
  },
];

export const SHIPPING_PROVIDER_IDS = [
  SHIPPING_PROVIDER.ANDREANI,
  SHIPPING_PROVIDER.CORREO_ARGENTINO,
] as const;

export const SHIPPING_METHOD_IDS = SHIPPING_PROVIDER_DEFINITIONS.flatMap((provider) => provider.services.map((service) => service.id));

const SHIPPING_METHOD_ALIASES: Readonly<Record<string, string>> = {
  "andreani:branch-delivery": "andreani:envío-a-sucursal",
  "andreani:envio-a-domicilio": "andreani:envío-a-domicilio",
  "andreani:envio-a-sucursal": "andreani:envío-a-sucursal",
  "andreani:home-delivery": "andreani:envío-a-domicilio",
  "correo-argentino:branch-pickup": "correo-argentino:retiro-en-sucursal",
  "correo-argentino:national-parcel": "correo-argentino:paquetería-nacional",
  "correo-argentino:paqueteria-nacional": "correo-argentino:paquetería-nacional",
};

export function normalizeShippingMethodId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();

  return SHIPPING_METHOD_ALIASES[normalized] ?? normalized;
}

export function isSupportedShippingMethodId(value: string): boolean {
  return SHIPPING_METHOD_IDS.includes(normalizeShippingMethodId(value));
}

export const FIXED_WEIGHT_BANDS = [
  { id: "range-up-to-1kg", maxGrams: 1_000, minGrams: 0 },
  { id: "range-1kg-to-3kg", maxGrams: 3_000, minGrams: 1_000 },
  { id: "range-3kg-to-5kg", maxGrams: 5_000, minGrams: 3_000 },
  { id: "range-5kg-to-10kg", maxGrams: 10_000, minGrams: 5_000 },
  { id: "range-over-10kg", maxGrams: null, minGrams: 10_000 },
] as const;

export const DEFAULT_WEIGHT_BANDS = FIXED_WEIGHT_BANDS;

export const PICKUP_POINT_STATUS = {
  ACTIVE: "active",
  CONFIGURED_INACTIVE: "configured_inactive",
  NOT_CONFIGURED: "not_configured",
} as const;

export type PickupPointStatus = (typeof PICKUP_POINT_STATUS)[keyof typeof PICKUP_POINT_STATUS];

export const PICKUP_COST_TYPE = {
  FIXED: "fixed",
  FREE: "free",
} as const;

export type PickupCostType = (typeof PICKUP_COST_TYPE)[keyof typeof PICKUP_COST_TYPE];

export const PICKUP_COVERAGE_TYPE = {
  ALL: "all",
  PROVINCES: "provinces",
} as const;

export type PickupCoverageType = (typeof PICKUP_COVERAGE_TYPE)[keyof typeof PICKUP_COVERAGE_TYPE];

export const PICKUP_WEEK_DAY = {
  FRIDAY: "friday",
  MONDAY: "monday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
  THURSDAY: "thursday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
} as const;

export type PickupWeekDay = (typeof PICKUP_WEEK_DAY)[keyof typeof PICKUP_WEEK_DAY];

export const ARGENTINE_SHIPPING_ZONE = {
  BUENOS_AIRES: "ar-buenos-aires",
  CABA: "ar-caba",
  CATAMARCA: "ar-catamarca",
  CHACO: "ar-chaco",
  CHUBUT: "ar-chubut",
  CORDOBA: "ar-cordoba",
  CORRIENTES: "ar-corrientes",
  ENTRE_RIOS: "ar-entre-rios",
  FORMOSA: "ar-formosa",
  JUJUY: "ar-jujuy",
  LA_PAMPA: "ar-la-pampa",
  LA_RIOJA: "ar-la-rioja",
  MENDOZA: "ar-mendoza",
  MISIONES: "ar-misiones",
  NEUQUEN: "ar-neuquen",
  RIO_NEGRO: "ar-rio-negro",
  SALTA: "ar-salta",
  SAN_JUAN: "ar-san-juan",
  SAN_LUIS: "ar-san-luis",
  SANTA_CRUZ: "ar-santa-cruz",
  SANTA_FE: "ar-santa-fe",
  SANTIAGO_DEL_ESTERO: "ar-santiago-del-estero",
  TIERRA_DEL_FUEGO: "ar-tierra-del-fuego",
  TUCUMAN: "ar-tucuman",
} as const;

export const ARGENTINE_SHIPPING_ZONE_IDS: readonly string[] = Object.values(ARGENTINE_SHIPPING_ZONE);

export function isSupportedShippingZoneId(value: string): boolean {
  return ARGENTINE_SHIPPING_ZONE_IDS.includes(value);
}

export const COUPON_DISCOUNT_TYPE = {
  FIXED: "fixed",
  FREE_SHIPPING: "free_shipping",
  PERCENTAGE: "percentage",
} as const;

export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPE)[keyof typeof COUPON_DISCOUNT_TYPE];

export const COUPON_TARGET_TYPE = {
  ALL_STORE: "all_store",
  CATEGORIES: "categories",
  PRODUCTS: "products",
} as const;

export type CouponTargetType = (typeof COUPON_TARGET_TYPE)[keyof typeof COUPON_TARGET_TYPE];

export const COUPON_USAGE_LIMIT_TYPE = {
  LIMITED: "limited",
  UNLIMITED: "unlimited",
} as const;

export type CouponUsageLimitType = (typeof COUPON_USAGE_LIMIT_TYPE)[keyof typeof COUPON_USAGE_LIMIT_TYPE];

export const COUPON_CUSTOMER_LIMIT_TYPE = {
  FIRST_PURCHASE: "first_purchase",
  LIMITED: "limited",
  UNLIMITED: "unlimited",
} as const;

export type CouponCustomerLimitType = (typeof COUPON_CUSTOMER_LIMIT_TYPE)[keyof typeof COUPON_CUSTOMER_LIMIT_TYPE];

export const COUPON_DATE_LIMIT_TYPE = {
  PERIOD: "period",
  UNLIMITED: "unlimited",
} as const;

export type CouponDateLimitType = (typeof COUPON_DATE_LIMIT_TYPE)[keyof typeof COUPON_DATE_LIMIT_TYPE];

export const COUPON_MAX_DISCOUNT_TYPE = {
  AMOUNT: "amount",
  NONE: "none",
} as const;

export type CouponMaxDiscountType = (typeof COUPON_MAX_DISCOUNT_TYPE)[keyof typeof COUPON_MAX_DISCOUNT_TYPE];

export const DISCOUNT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type DiscountStatus = (typeof DISCOUNT_STATUS)[keyof typeof DISCOUNT_STATUS];

export const COUPON_HISTORY_ACTION = {
  ACTIVATED: "activated",
  CREATED: "created",
  DEACTIVATED: "deactivated",
  UPDATED: "updated",
} as const;

export type CouponHistoryAction = (typeof COUPON_HISTORY_ACTION)[keyof typeof COUPON_HISTORY_ACTION];

export const SHIPPING_DISCOUNT_TARGET_TYPE = {
  ALL_STORE: "all_store",
  CATEGORIES: "categories",
} as const;

export type ShippingDiscountTargetType = (typeof SHIPPING_DISCOUNT_TARGET_TYPE)[keyof typeof SHIPPING_DISCOUNT_TARGET_TYPE];

export const SHIPPING_ZONE_TARGET_TYPE = {
  ALL: "all",
  SPECIFIC: "specific",
} as const;

export type ShippingZoneTargetType = (typeof SHIPPING_ZONE_TARGET_TYPE)[keyof typeof SHIPPING_ZONE_TARGET_TYPE];

export const COMMERCE_DEFAULT_PREPARATION_HOURS = 24;
