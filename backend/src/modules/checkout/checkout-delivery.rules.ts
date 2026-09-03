import { ConflictException, Injectable } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { Prisma } from "../../generated/prisma/client";
import {
  CHECKOUT_DELIVERY_TYPE,
  type CheckoutDeliveryType,
} from "./checkout.constants";
import type {
  CheckoutAddressInput,
} from "./checkout.schemas";
import type {
  CheckoutPickupPointProjection,
  CheckoutShippingOptionProjection,
  CheckoutWarningProjection,
} from "./checkout.mapper";
import type { ResolvedCheckoutLine } from "./checkout-line-resolver";
import type { TransactionClient } from "./checkout.repository";
import { slugify } from "../catalog/catalog.schemas";
import {
  normalizeShippingMethodId,
  SHIPPING_PROVIDER_DEFINITIONS,
} from "../commerce/commerce.constants";
import {
  toPickupPointProjection,
  toShippingProviderProjection,
  type PickupPointProjection,
  type ShippingProviderProjection,
} from "../commerce/commerce.mapper";
import { CommerceRepository } from "../commerce/commerce.repository";

export interface CheckoutDeliveryInput {
  address?: CheckoutAddressInput;
  pickupPointId?: string;
  province?: string;
  shippingMethodId?: string;
  shippingProviderId?: string;
}

export interface DeliveryCalculation {
  baseCost: number;
  cost: number;
  pickupPoint?: CheckoutPickupPointProjection;
  shippingOption?: CheckoutShippingOptionProjection;
  snapshot: Prisma.InputJsonValue;
  type?: CheckoutDeliveryType;
}

export interface DeliveryRulesCalculation {
  delivery: DeliveryCalculation;
  pickupPoints: CheckoutPickupPointProjection[];
  shippingOptions: CheckoutShippingOptionProjection[];
}

interface AvailablePickupPoint {
  details: PickupPointProjection;
  projection: CheckoutPickupPointProjection;
}

@Injectable()
export class CheckoutDeliveryRules {
  constructor(private readonly commerceRepository: CommerceRepository) {}

  async calculate(
    transaction: TransactionClient,
    input: CheckoutDeliveryInput,
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
    required: boolean,
  ): Promise<DeliveryRulesCalculation> {
    const shippingProviders = await this.checkoutShippingProviders(transaction);
    const shippingOptions = this.shippingOptions(shippingProviders, lines, subtotal);
    const availablePickupPoints = await this.checkoutPickupPoints(transaction, input);
    const pickupPoints = availablePickupPoints.map((point) => point.projection);
    const delivery = this.deliverySelection(input, shippingOptions, availablePickupPoints, required);

    return { delivery, pickupPoints, shippingOptions };
  }

  warnings(
    shippingOptions: readonly CheckoutShippingOptionProjection[],
    lines: readonly ResolvedCheckoutLine[],
    delivery: DeliveryCalculation,
  ): CheckoutWarningProjection[] {
    const warnings: CheckoutWarningProjection[] = [];
    if (lines.some((line) => line.product.shippingRequired && line.weightGrams === null) && !delivery.pickupPoint) {
      warnings.push({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE, message: "Shipping requires product weight configuration." });
    } else if (shippingOptions.length === 0 && !delivery.pickupPoint) {
      warnings.push({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE, message: "No shipping options are currently available." });
    }
    return warnings;
  }

  private async checkoutShippingProviders(transaction: TransactionClient): Promise<ShippingProviderProjection[]> {
    return (await this.commerceRepository.checkoutShippingProviders(transaction)).map(toShippingProviderProjection);
  }

  private shippingOptions(
    providers: readonly ShippingProviderProjection[],
    lines: readonly ResolvedCheckoutLine[],
    subtotal: number,
  ): CheckoutShippingOptionProjection[] {
    const totalWeight = lines.reduce<number | null>((total, line) => {
      if (total === null || line.totalWeightGrams === null) return null;
      return total + line.totalWeightGrams;
    }, 0);
    if (totalWeight === null) return [];

    return providers.flatMap((provider) => {
      const definition = SHIPPING_PROVIDER_DEFINITIONS.find((candidate) => candidate.id === provider.id);
      if (!definition) return [];

      return definition.services.flatMap((service) => {
        if (!provider.enabledModalities.includes(service.modality)) return [];
        const cost = this.shippingCost(provider, totalWeight, subtotal);
        if (cost === undefined) return [];
        return [{
          cost,
          id: service.id,
          label: service.label,
          modality: service.modality,
          providerId: provider.id,
          providerName: provider.name,
        }];
      });
    });
  }

  private shippingCost(provider: ShippingProviderProjection, totalWeight: number, subtotal: number): number | undefined {
    const band = provider.weightRanges.find((candidate) => {
      return totalWeight >= candidate.minGrams && (candidate.maxGrams === null || totalWeight < candidate.maxGrams);
    });
    if (!band) return undefined;
    if (provider.freeShippingThreshold !== undefined && subtotal >= provider.freeShippingThreshold) return 0;
    return band.cost;
  }

  private async checkoutPickupPoints(
    transaction: TransactionClient,
    input: CheckoutDeliveryInput,
  ): Promise<AvailablePickupPoint[]> {
    const province = input.province ?? input.address?.province;
    return (await this.commerceRepository.checkoutPickupPoints(transaction))
      .map(toPickupPointProjection)
      .filter((point) => this.isPickupPointAvailable(point, province))
      .map((point) => ({
        details: point,
        projection: {
          address: point.address,
          id: point.id,
          name: point.name,
          preparationHours: point.preparationHours,
        },
      }));
  }

  private isPickupPointAvailable(point: PickupPointProjection, province: string | undefined): boolean {
    if (!point.address.city || !point.address.province || !point.address.postalCode || !point.address.street) return false;
    if (point.coverageType === "all") return true;
    if (!province) return false;
    const requested = normalizeLocation(province);
    return point.provinces.some((candidate) => normalizeLocation(candidate) === requested);
  }

  private deliverySelection(
    input: CheckoutDeliveryInput,
    shippingOptions: readonly CheckoutShippingOptionProjection[],
    pickupPoints: readonly AvailablePickupPoint[],
    required: boolean,
  ): DeliveryCalculation {
    if (input.pickupPointId) {
      const available = pickupPoints.find((candidate) => candidate.projection.id === input.pickupPointId);
      if (!available) throw this.shippingUnavailable();
      const pickupPoint = available.projection;
      const cost = available.details.costType === "fixed" ? available.details.fixedCost ?? 0 : 0;
      if (available.details.costType === "fixed" && available.details.fixedCost === undefined) throw this.shippingUnavailable();
      return {
        baseCost: cost,
        cost,
        pickupPoint,
        snapshot: {
          cost,
          pickupPointId: pickupPoint.id,
          pickupPointName: pickupPoint.name,
          type: CHECKOUT_DELIVERY_TYPE.PICKUP,
        },
        type: CHECKOUT_DELIVERY_TYPE.PICKUP,
      };
    }

    let selectedId = input.shippingMethodId ? normalizeShippingMethodId(input.shippingMethodId) : undefined;
    if (!selectedId && input.shippingProviderId) {
      selectedId = shippingOptions.find((option) => option.providerId === input.shippingProviderId)?.id;
    }
    if (selectedId) {
      const shippingOption = shippingOptions.find((option) => option.id === selectedId);
      if (!shippingOption || (input.shippingProviderId && shippingOption.providerId !== input.shippingProviderId)) {
        throw this.shippingUnavailable();
      }
      return {
        baseCost: shippingOption.cost,
        cost: shippingOption.cost,
        shippingOption,
        snapshot: {
          baseCost: shippingOption.cost,
          label: shippingOption.label,
          methodId: shippingOption.id,
          modality: shippingOption.modality,
          providerId: shippingOption.providerId,
          providerName: shippingOption.providerName,
          type: CHECKOUT_DELIVERY_TYPE.SHIPPING,
        },
        type: CHECKOUT_DELIVERY_TYPE.SHIPPING,
      };
    }

    if (required) throw this.shippingUnavailable();
    return { baseCost: 0, cost: 0, snapshot: { type: "none" } };
  }

  private shippingUnavailable(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE, message: "The selected shipping option is unavailable.", ok: false });
  }
}

function normalizeLocation(value: string): string {
  return slugify(value);
}
