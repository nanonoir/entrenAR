import { DEFAULT_WEIGHT_RANGES } from "@/schemas/admin/shipping-schemas";
import type { PickupPoint, ShippingProviderConfig, ShippingProviderDefinition } from "@/types/shipping";

export type {
  PickupCostType,
  PickupCoverageType,
  PickupPoint,
  PickupPointAddress,
  PickupScheduleRange,
  ShippingConfigStatus,
  ShippingModality,
  ShippingOrigin,
  ShippingProviderConfig,
  ShippingProviderDefinition,
  ShippingProviderId,
  WeightRange,
} from "@/types/shipping";

export const shippingProviderDefinitions: ShippingProviderDefinition[] = [
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
