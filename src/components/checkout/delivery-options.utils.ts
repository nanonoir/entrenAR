import { CHECKOUT_HOME_DELIVERY_MODALITY } from "@/components/checkout/checkout-form.validators";
import type {
  CheckoutAddressInput,
  CheckoutPickupPoint,
  CheckoutQuote,
  CheckoutShippingOption,
} from "@/lib/api/checkout/checkout.repository";
import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** One selectable home-delivery service. `id` is the exact `CheckoutShippingOption.id`, never a provider id. */
export type ShippingChoice = {
  id: string;
  providerId: string;
  /** Carrier brand: the primary label of the card. */
  carrierName: string;
  logoSrc: string | null;
  /** Service description: secondary text. */
  serviceLabel: string;
  eta: string | null;
  price: number;
};

export type PickupChoice = {
  id: string;
  name: string;
  address: string;
  eta: string;
};

const CARRIER_BRANDS: readonly { logoSrc: string; match: string; name: string }[] = [
  { logoSrc: "/correoArgentino.svg", match: "correo", name: "Correo Argentino" },
  { logoSrc: "/andreani.svg", match: "andreani", name: "Andreani" },
];

export function getCarrierBrand(providerId: string, providerName: string): { logoSrc: string | null; name: string } {
  const normalized = providerId.trim().toLocaleLowerCase();
  const brand = CARRIER_BRANDS.find((candidate) => normalized.includes(candidate.match));
  return brand ? { logoSrc: brand.logoSrc, name: brand.name } : { logoSrc: null, name: providerName };
}

/** Home delivery lists only `home_delivery` services; branch/pickup modalities are never offered here. */
export function getShippingChoices(quote: CheckoutQuote | null): ShippingChoice[] {
  if (!quote) return [];
  return quote.shippingOptions
    .filter((option) => option.modality === CHECKOUT_HOME_DELIVERY_MODALITY)
    .map(toShippingChoice);
}

/** Choices only exist for services of a ready quote, so zero is a confirmed quoted zero, never a fallback. */
export function formatShippingPrice(price: number): string {
  return price === 0 ? "Gratis" : formatCurrency(price);
}

export function getPickupChoices(quote: CheckoutQuote | null): PickupChoice[] {
  return quote ? quote.pickupPoints.map(toPickupChoice) : [];
}

export function isShippingSelectionUnavailable(
  quote: CheckoutQuote | null,
  isHomeDelivery: boolean,
  selectedShippingId: string | null,
  choices: readonly ShippingChoice[],
): boolean {
  return Boolean(quote && isHomeDelivery && selectedShippingId && !choices.some((choice) => choice.id === selectedShippingId));
}

export function isPickupSelectionUnavailable(
  quote: CheckoutQuote | null,
  isPickupDelivery: boolean,
  selectedPickupPointId: string | null,
  choices: readonly PickupChoice[],
): boolean {
  return Boolean(quote && isPickupDelivery && selectedPickupPointId && !choices.some((choice) => choice.id === selectedPickupPointId));
}

export function deliveryChoiceClass(selected: boolean): string {
  return cn(
    "cursor-pointer rounded-card border p-4 text-left font-subtitle text-sm font-semibold uppercase transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
    selected ? "border-accent bg-accent-soft text-accent-hover" : "border-border bg-surface hover:border-accent",
  );
}

export function deliveryCardClass(selected: boolean): string {
  return cn(
    "cursor-pointer rounded-card border bg-surface p-4 text-left transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
    selected ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent",
  );
}

export function toShippingChoice(option: CheckoutShippingOption): ShippingChoice {
  const brand = getCarrierBrand(option.providerId, option.providerName);

  return {
    carrierName: brand.name,
    eta: option.estimatedDelivery ?? null,
    id: option.id,
    logoSrc: brand.logoSrc,
    price: option.cost,
    providerId: option.providerId,
    serviceLabel: option.label,
  };
}

export function toPickupChoice(point: CheckoutPickupPoint): PickupChoice {
  return {
    address: formatAddress(point.address),
    eta: formatPreparationTime(point.preparationHours),
    id: point.id,
    name: point.name,
  };
}

export function formatAddress(address: CheckoutAddressInput): string {
  const street = [address.street, address.number].filter(Boolean).join(" ");
  return [street, address.city, address.province, address.postalCode].filter(Boolean).join(", ");
}

export function formatPreparationTime(hours: number): string {
  return hours === 1 ? "Retiro disponible en 1 hora" : `Retiro disponible en ${hours} hs`;
}
