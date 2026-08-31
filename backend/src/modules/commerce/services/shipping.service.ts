import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../../common/errors/api-error.response";
import {
  PickupCostType,
  PickupCoverageType,
  PickupPointStatus,
  ShippingProviderStatus,
} from "../../../generated/prisma/enums";
import {
  FIXED_WEIGHT_BANDS,
  PICKUP_COST_TYPE,
  PICKUP_COVERAGE_TYPE,
  PICKUP_POINT_STATUS,
  SHIPPING_PROVIDER_DEFINITIONS,
  SHIPPING_PROVIDER_STATUS,
} from "../commerce.constants";
import { toPickupPointProjection, toShippingProviderProjection, type PickupPointProjection, type ShippingProviderProjection, type ShippingProviderRecord } from "../commerce.mapper";
import { CommerceRepository, type PickupPointUpdateRecord, type ShippingProviderOriginRecord } from "../commerce.repository";
import { findScheduleOverlap, type PickupPointUpdateInput, type ShippingProviderUpdateInput } from "../schemas/shipping.schemas";

const PICKUP_DAY_ORDER: Readonly<Record<string, number>> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

@Injectable()
export class ShippingService {
  constructor(private readonly commerceRepository: CommerceRepository) {}

  async listProviders(): Promise<ShippingProviderProjection[]> {
    const records = await this.commerceRepository.shippingProviders();

    return records.map(toShippingProviderProjection);
  }

  async getShippingProviders(): Promise<ShippingProviderProjection[]> {
    return this.listProviders();
  }

  async updateProvider(providerId: string, input: ShippingProviderUpdateInput): Promise<ShippingProviderProjection> {
    const definition = SHIPPING_PROVIDER_DEFINITIONS.find((candidate) => candidate.id === providerId);
    if (!definition) throw this.notFound("The requested shipping provider was not found.");

    return this.commerceRepository.transaction(async (transaction) => {
      const current = await this.commerceRepository.shippingProviderById(transaction, providerId);
      if (!current) throw this.notFound("The requested shipping provider was not found.");

      if (
        current.status !== ShippingProviderStatus.NOT_CONFIGURED
        && input.status === SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED
      ) {
        throw this.invalidProviderStatus();
      }

      const weightBands = this.toWeightBandCosts(current, input.weightRanges);
      const origin = input.origin ? this.toOriginRecord(input.origin) : {};

      if (input.status !== SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED && !input.origin) {
        throw this.invalidProviderStatus();
      }

      const updated = await this.commerceRepository.updateShippingProvider(transaction, providerId, {
        enabledModalities: [...input.enabledModalities],
        freeShippingThreshold: input.freeShippingThreshold ?? null,
        origin,
        status: this.toShippingProviderStatus(input.status),
        weightBands,
      });

      return toShippingProviderProjection(updated);
    });
  }

  async updateShippingProvider(providerId: string, input: ShippingProviderUpdateInput): Promise<ShippingProviderProjection> {
    return this.updateProvider(providerId, input);
  }

  async listPickupPoints(): Promise<PickupPointProjection[]> {
    const records = await this.commerceRepository.pickupPoints();

    return records.map(toPickupPointProjection);
  }

  async getPickupPoints(): Promise<PickupPointProjection[]> {
    return this.listPickupPoints();
  }

  async updatePickupPoint(id: string, input: PickupPointUpdateInput): Promise<PickupPointProjection> {
    return this.commerceRepository.transaction(async (transaction) => {
      await this.commerceRepository.lockPickupPoints(transaction);
      const current = await this.commerceRepository.pickupPointById(transaction, id);
      if (!current) throw this.notFound("The requested pickup point was not found.");

      this.assertPickupConfiguration(input);
      if (input.isMain) await this.commerceRepository.clearMainPickupPoints(transaction, id);

      const updated = await this.commerceRepository.updatePickupPoint(transaction, id, this.toPickupPointRecord(input));

      return toPickupPointProjection(updated);
    });
  }

  async savePickupPoint(id: string, input: PickupPointUpdateInput): Promise<PickupPointProjection> {
    return this.updatePickupPoint(id, input);
  }

  private toWeightBandCosts(
    current: ShippingProviderRecord,
    ranges: ShippingProviderUpdateInput["weightRanges"],
  ) {
    if (!current || current.weightBands.length !== FIXED_WEIGHT_BANDS.length) {
      throw this.invalidWeightRange();
    }

    return FIXED_WEIGHT_BANDS.map((expected, index) => {
      const range = ranges[index];
      const persisted = current.weightBands.find((band) => band.minWeightGrams === expected.minGrams && band.maxWeightGrams === expected.maxGrams);

      if (!range || !persisted) throw this.invalidWeightRange();
      if (range.id !== expected.id || range.minGrams !== expected.minGrams || range.maxGrams !== expected.maxGrams) {
        throw this.invalidWeightRange();
      }

      return { cost: range.cost, id: persisted.id };
    });
  }

  private toOriginRecord(input: NonNullable<ShippingProviderUpdateInput["origin"]>): ShippingProviderOriginRecord {
    return {
      apartment: input.apartment,
      city: input.city,
      cuitCuil: input.cuitCuil,
      email: input.email,
      floor: input.floor,
      number: input.number,
      phone: input.phone,
      postalCode: input.postalCode,
      province: input.province,
      reference: input.reference,
      senderName: input.senderName,
      street: input.street,
    };
  }

  private toPickupPointRecord(input: PickupPointUpdateInput): PickupPointUpdateRecord {
    const sortedSchedule = [...input.schedule].sort((left, right) => {
      return (PICKUP_DAY_ORDER[left.day] ?? Number.MAX_SAFE_INTEGER) - (PICKUP_DAY_ORDER[right.day] ?? Number.MAX_SAFE_INTEGER)
        || left.from.localeCompare(right.from)
        || (left.id ?? "").localeCompare(right.id ?? "");
    });

    return {
      city: input.address?.city ?? null,
      contactEmail: input.contactEmail ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      costType: this.toPickupCostType(input.costType),
      coverageType: this.toPickupCoverageType(input.coverageType),
      fixedCost: input.costType === PICKUP_COST_TYPE.FIXED ? input.fixedCost ?? null : null,
      isMain: input.isMain,
      name: input.name,
      number: input.address?.number ?? null,
      postalCode: input.address?.postalCode ?? null,
      preparationHours: input.preparationHours,
      provinces: [...input.provinces],
      province: input.address?.province ?? null,
      schedules: sortedSchedule.map((range, index) => ({
        closesAt: range.to,
        dayOfWeek: range.day,
        ...(range.id ? { id: range.id } : {}),
        opensAt: range.from,
        sortOrder: index + 1,
      })),
      status: this.toPickupPointStatus(input.status),
      street: input.address?.street ?? null,
    };
  }

  private assertPickupConfiguration(input: PickupPointUpdateInput): void {
    if (input.status !== PICKUP_POINT_STATUS.NOT_CONFIGURED && (!input.address || input.schedule.length === 0)) {
      throw this.invalidPickupConfiguration();
    }

    for (const range of input.schedule) {
      if (range.to <= range.from) throw this.invalidPickupConfiguration();
    }

    if (findScheduleOverlap(input.schedule) !== undefined) {
      throw this.scheduleOverlap();
    }

    if (input.costType === PICKUP_COST_TYPE.FIXED && input.fixedCost === undefined) {
      throw this.invalidPickupConfiguration();
    }

    if (input.coverageType === PICKUP_COVERAGE_TYPE.PROVINCES && input.provinces.length === 0) {
      throw this.invalidPickupConfiguration();
    }
  }

  private toShippingProviderStatus(status: ShippingProviderUpdateInput["status"]): ShippingProviderStatus {
    if (status === SHIPPING_PROVIDER_STATUS.ACTIVE) return ShippingProviderStatus.ACTIVE;
    if (status === SHIPPING_PROVIDER_STATUS.CONFIGURED_INACTIVE) return ShippingProviderStatus.CONFIGURED_INACTIVE;
    return ShippingProviderStatus.NOT_CONFIGURED;
  }

  private toPickupPointStatus(status: PickupPointUpdateInput["status"]): PickupPointStatus {
    if (status === PICKUP_POINT_STATUS.ACTIVE) return PickupPointStatus.ACTIVE;
    if (status === PICKUP_POINT_STATUS.CONFIGURED_INACTIVE) return PickupPointStatus.CONFIGURED_INACTIVE;
    return PickupPointStatus.NOT_CONFIGURED;
  }

  private toPickupCostType(costType: PickupPointUpdateInput["costType"]): PickupCostType {
    return costType === PICKUP_COST_TYPE.FIXED ? PickupCostType.FIXED : PickupCostType.FREE;
  }

  private toPickupCoverageType(coverageType: PickupPointUpdateInput["coverageType"]): PickupCoverageType {
    return coverageType === PICKUP_COVERAGE_TYPE.PROVINCES ? PickupCoverageType.PROVINCES : PickupCoverageType.ALL;
  }

  private invalidWeightRange(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.INVALID_WEIGHT_RANGE,
      message: "Shipping weight-band boundaries are fixed and must remain complete.",
      ok: false,
    });
  }

  private invalidProviderStatus(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.INVALID_PROVIDER_STATUS,
      message: "The shipping provider status transition is not supported.",
      ok: false,
    });
  }

  private invalidPickupConfiguration(): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODE.INVALID_PICKUP_CONFIGURATION,
      message: "Pickup point configuration is invalid.",
      ok: false,
    });
  }

  private scheduleOverlap(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.PICKUP_SCHEDULE_OVERLAP,
      message: "Pickup schedule ranges must not overlap on the same day.",
      ok: false,
    });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message, ok: false });
  }
}
