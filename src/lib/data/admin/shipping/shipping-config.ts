export type ShippingProviderId = "andreani" | "correo-argentino";
export type ShippingConfigStatus = "not_configured" | "configured_inactive" | "active";
export type ShippingModality = "home_delivery" | "branch_delivery";
export type PickupCostType = "free" | "fixed";
export type PickupCoverageType = "all" | "provinces";

export type WeightRange = {
  id: string;
  minGrams: number;
  maxGrams: number;
  cost: number;
};

export type ShippingProviderConfig = {
  id: ShippingProviderId;
  name: string;
  status: ShippingConfigStatus;
  enabledModalities: ShippingModality[];
  origin: {
    senderName: string;
    phone: string;
    email: string;
    street: string;
    number: string;
    city: string;
    province: string;
    postalCode: string;
  };
  weightRanges: WeightRange[];
  freeShippingThreshold?: number;
  updatedAt?: string;
};

export type PickupScheduleRange = {
  id: string;
  day: string;
  from: string;
  to: string;
};

export type PickupPoint = {
  id: string;
  name: string;
  status: ShippingConfigStatus;
  isMain: boolean;
  address: {
    street: string;
    number: string;
    city: string;
    province: string;
    postalCode: string;
  };
  contactName?: string;
  contactPhone?: string;
  schedule: PickupScheduleRange[];
  preparationHours: number;
  costType: PickupCostType;
  fixedCost?: number;
  coverageType: PickupCoverageType;
  provinces: string[];
  updatedAt?: string;
};

export const shippingProviderDefinitions: Array<{ id: ShippingProviderId; name: string; services: string[] }> = [
  { id: "andreani", name: "Andreani", services: ["Envío a domicilio", "Envío a sucursal"] },
  { id: "correo-argentino", name: "Correo Argentino", services: ["Paquetería nacional", "Retiro en sucursal"] },
];

export const initialShippingProviders: ShippingProviderConfig[] = shippingProviderDefinitions.map((provider) => ({
  id: provider.id,
  name: provider.name,
  status: "not_configured",
  enabledModalities: [],
  origin: { senderName: "", phone: "", email: "", street: "", number: "", city: "", province: "", postalCode: "" },
  weightRanges: DEFAULT_WEIGHT_RANGES.map((range) => ({ ...range })),
}));

export const initialPickupPoints: PickupPoint[] = [
  {
    id: "retiro-principal",
    name: "Punto de retiro principal",
    status: "not_configured",
    isMain: true,
    address: { street: "", number: "", city: "", province: "", postalCode: "" },
    schedule: [],
    preparationHours: 24,
    costType: "free",
    coverageType: "all",
    provinces: [],
  },
];

export async function getShippingProviderDefinitions() {
  return shippingProviderDefinitions;
}
import { DEFAULT_WEIGHT_RANGES } from "@/schemas/admin/shipping-schemas";
