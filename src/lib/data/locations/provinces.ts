import provincesSnapshot from "./snapshots/provinces.json";

export type CheckoutProvince = { id: string; name: string };

/**
 * Georef publishes the long official name for province 94; the commerce zones (`ar-tierra-del-fuego`) and the CRM use the short one.
 */
const CHECKOUT_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "94": "Tierra del Fuego",
};

export const CHECKOUT_PROVINCES: readonly CheckoutProvince[] = (provincesSnapshot as readonly CheckoutProvince[])
  .map((province) => ({ id: province.id, name: CHECKOUT_NAME_OVERRIDES[province.id] ?? province.name }))
  .sort((left, right) => left.name.localeCompare(right.name, "es"));

export function findProvinceById(provinceId: string): CheckoutProvince | undefined {
  return CHECKOUT_PROVINCES.find((province) => province.id === provinceId);
}
