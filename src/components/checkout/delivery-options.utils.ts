import type {
  CheckoutAddressInput,
  CheckoutPickupPoint as ServerCheckoutPickupPoint,
  CheckoutQuote,
  CheckoutShippingOption,
} from "@/lib/api/checkout/checkout.repository";
import {
  checkoutShippingProviders,
  type CheckoutPickupPoint as MockCheckoutPickupPoint,
  type CheckoutPostalCodeLocation,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

export type ShippingChoice = {
  id: string;
  label: string;
  description: string;
  eta: string;
  logoSrc: string;
  price: number;
  provider: CheckoutShippingProvider;
  selectionIds: readonly string[];
};

export type PickupChoice = {
  id: string;
  name: string;
  address: string;
  eta: string;
  point: MockCheckoutPickupPoint;
};

export function getShippingChoices(serverQuote: CheckoutQuote | null): ShippingChoice[] {
  return serverQuote
    ? serverQuote.shippingOptions.map(toServerShippingChoice)
    : checkoutShippingProviders.map(toMockShippingChoice);
}

export function getPickupChoices(
  serverQuote: CheckoutQuote | null,
  location: CheckoutPostalCodeLocation | undefined,
): PickupChoice[] {
  return serverQuote
    ? serverQuote.pickupPoints.map(toServerPickupChoice)
    : (location?.pickupPoints ?? []).map(toMockPickupChoice);
}

export function isShippingChoiceSelected(choice: ShippingChoice, selectedProviderId: string): boolean {
  return choice.selectionIds.some((id) => matchesId(id, selectedProviderId));
}

export function isPickupChoiceSelected(choice: PickupChoice, selectedPickupPointId: string | null): boolean {
  return selectedPickupPointId === choice.id;
}

export function isShippingSelectionUnavailable(
  serverQuote: CheckoutQuote | null,
  isHomeDelivery: boolean,
  selectedProviderId: string,
  choices: readonly ShippingChoice[],
): boolean {
  return Boolean(
    serverQuote
      && isHomeDelivery
      && selectedProviderId
      && !choices.some((choice) => isShippingChoiceSelected(choice, selectedProviderId)),
  );
}

export function isPickupSelectionUnavailable(
  serverQuote: CheckoutQuote | null,
  isPickupDelivery: boolean,
  selectedPickupPointId: string | null,
  choices: readonly PickupChoice[],
): boolean {
  return Boolean(
    serverQuote
      && isPickupDelivery
      && selectedPickupPointId
      && !choices.some((choice) => isPickupChoiceSelected(choice, selectedPickupPointId)),
  );
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

export function toMockShippingChoice(provider: CheckoutShippingProvider): ShippingChoice {
  const normalizedId = normalizeProviderId(provider.id);
  const normalizedProvider = { ...provider, id: normalizedId };

  return {
    description: provider.description,
    eta: provider.eta,
    id: normalizedId,
    label: provider.name,
    logoSrc: provider.logoSrc,
    price: provider.price,
    provider: normalizedProvider,
    selectionIds: [normalizedId, provider.id],
  };
}

export function toServerShippingChoice(option: CheckoutShippingOption): ShippingChoice {
  const fallback = checkoutShippingProviders.find((provider) => normalizeProviderId(provider.id) === normalizeProviderId(option.providerId));
  const label = option.label || option.providerName;
  const provider: CheckoutShippingProvider = {
    description: label,
    eta: option.estimatedDelivery ?? fallback?.eta ?? "Consultar disponibilidad",
    id: option.providerId,
    logoSrc: fallback?.logoSrc ?? shippingLogoFor(option.providerId),
    name: option.providerName,
    price: option.cost,
  };

  return {
    description: label,
    eta: provider.eta,
    id: option.providerId,
    label,
    logoSrc: provider.logoSrc,
    price: option.cost,
    provider,
    selectionIds: [option.providerId, option.id],
  };
}

export function toMockPickupChoice(point: MockCheckoutPickupPoint): PickupChoice {
  return { address: point.address, eta: point.eta, id: point.id, name: point.name, point };
}

export function toServerPickupChoice(point: ServerCheckoutPickupPoint): PickupChoice {
  const address = formatAddress(point.address);
  const eta = formatPreparationTime(point.preparationHours);

  return {
    address,
    eta,
    id: point.id,
    name: point.name,
    point: { address, eta, id: point.id, name: point.name },
  };
}

export function formatAddress(address: CheckoutAddressInput): string {
  const street = [address.street, address.number].filter(Boolean).join(" ");
  return [street, address.city, address.province, address.postalCode].filter(Boolean).join(", ");
}

export function formatPreparationTime(hours: number): string {
  return hours === 1 ? "Retiro disponible en 1 hora" : `Retiro disponible en ${hours} hs`;
}

export function matchesId(left: string, right: string): boolean {
  return normalizeProviderId(left) === normalizeProviderId(right);
}

export function normalizeProviderId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  const aliases: Record<string, string> = {
    "andreani-home": "andreani",
    "correo-argentino-branch": "correo-argentino",
  };

  return aliases[normalized] ?? normalized;
}

export function shippingLogoFor(providerId: string): string {
  return normalizeProviderId(providerId).includes("correo") ? "/correoArgentino.svg" : "/andreani.svg";
}
