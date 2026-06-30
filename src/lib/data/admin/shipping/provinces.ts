import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";

export const argentineShippingProvinces: DiscountSelectOption[] = [
  { id: "ar-caba", label: "Ciudad Autónoma de Buenos Aires" },
  { id: "ar-buenos-aires", label: "Buenos Aires" },
  { id: "ar-catamarca", label: "Catamarca" },
  { id: "ar-chaco", label: "Chaco" },
  { id: "ar-chubut", label: "Chubut" },
  { id: "ar-cordoba", label: "Córdoba" },
  { id: "ar-corrientes", label: "Corrientes" },
  { id: "ar-entre-rios", label: "Entre Ríos" },
  { id: "ar-formosa", label: "Formosa" },
  { id: "ar-jujuy", label: "Jujuy" },
  { id: "ar-la-pampa", label: "La Pampa" },
  { id: "ar-la-rioja", label: "La Rioja" },
  { id: "ar-mendoza", label: "Mendoza" },
  { id: "ar-misiones", label: "Misiones" },
  { id: "ar-neuquen", label: "Neuquén" },
  { id: "ar-rio-negro", label: "Río Negro" },
  { id: "ar-salta", label: "Salta" },
  { id: "ar-san-juan", label: "San Juan" },
  { id: "ar-san-luis", label: "San Luis" },
  { id: "ar-santa-cruz", label: "Santa Cruz" },
  { id: "ar-santa-fe", label: "Santa Fe" },
  { id: "ar-santiago-del-estero", label: "Santiago del Estero" },
  { id: "ar-tierra-del-fuego", label: "Tierra del Fuego" },
  { id: "ar-tucuman", label: "Tucumán" },
];

export async function getArgentineShippingProvinces() {
  return argentineShippingProvinces;
}
