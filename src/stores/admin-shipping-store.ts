"use client";

import { create } from "zustand";
import {
  DATA_SOURCE,
  getCommerceRepository,
  type PickupPoint as CommercePickupPoint,
  type ShippingProvider as CommerceShippingProvider,
  type UpdatePickupPointDTO,
  type UpdateShippingProviderDTO,
} from "@/lib/api/commerce/commerce.repository";
import { initialPickupPoints, initialShippingProviders } from "@/lib/data/admin/shipping/shipping-config";
import type { PickupPoint, ShippingProviderConfig, ShippingProviderId } from "@/lib/data/admin/shipping/shipping-config";
import {
  COMMERCE_ASYNC_STATUS,
  toCommerceStoreError,
  type CommerceAsyncStatus,
  type CommerceStoreError,
} from "@/stores/admin-commerce-state";

export type AdminShippingState = {
  activeTab: "providers" | "pickups";
  clearError: () => void;
  error: CommerceStoreError | null;
  hasLoaded: boolean;
  isEmpty: boolean;
  load: () => Promise<boolean>;
  pickupPoints: CommercePickupPoint[];
  pickupPointsEmpty: boolean;
  providers: CommerceShippingProvider[];
  providersEmpty: boolean;
  setActiveTab: (tab: "providers" | "pickups") => void;
  saveProviderConfig: (config: ShippingProviderConfig) => Promise<boolean>;
  activateProvider: (providerId: ShippingProviderId) => Promise<boolean>;
  deactivateProvider: (providerId: ShippingProviderId) => Promise<boolean>;
  savePickupPoint: (pickupPoint: PickupPoint) => Promise<boolean>;
  activatePickupPoint: (pickupPointId: string) => Promise<boolean>;
  deactivatePickupPoint: (pickupPointId: string) => Promise<boolean>;
  source: CommerceShippingSource;
  status: CommerceAsyncStatus;
};

type CommerceShippingSource = ReturnType<typeof getCommerceRepository>["source"];

let operationSequence = 0;
const mockOnlyPickupPoints = new Map<string, CommercePickupPoint>();

const configuredRepository = getCommerceRepository();
const initialSource = configuredRepository.source;
const initialProviders = initialSource === DATA_SOURCE.MOCK
  ? initialShippingProviders.map(toCommerceShippingProvider)
  : [];
const initialStorePickupPoints = initialSource === DATA_SOURCE.MOCK
  ? initialPickupPointsFromStatic()
  : [];

export const useAdminShippingStore = create<AdminShippingState>()((set, get) => ({
  activeTab: "providers",
  clearError: () => set((state) => ({
    error: null,
    status: state.hasLoaded ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,
  })),
  error: null,
  hasLoaded: initialSource === DATA_SOURCE.MOCK,
  isEmpty: initialProviders.length === 0 && initialStorePickupPoints.length === 0,
  load: () => loadShippingConfiguration(set),
  pickupPoints: initialStorePickupPoints,
  pickupPointsEmpty: initialStorePickupPoints.length === 0,
  providers: initialProviders,
  providersEmpty: initialProviders.length === 0,
  setActiveTab: (activeTab) => set({ activeTab }),
  saveProviderConfig: (config) => updateProvider(set, get, normalizeProviderConfig(config)),
  activateProvider: (providerId) => updateProviderStatus(set, get, providerId, "active"),
  deactivateProvider: (providerId) => updateProviderStatus(set, get, providerId, "configured_inactive"),
  savePickupPoint: (pickupPoint) => savePickupPoint(set, get, normalizePickupPoint(pickupPoint)),
  activatePickupPoint: (pickupPointId) => updatePickupPointStatus(set, get, pickupPointId, "active"),
  deactivatePickupPoint: (pickupPointId) => updatePickupPointStatus(set, get, pickupPointId, "configured_inactive"),
  source: initialSource,
  status: initialSource === DATA_SOURCE.MOCK ? COMMERCE_ASYNC_STATUS.SUCCESS : COMMERCE_ASYNC_STATUS.IDLE,
}));

type ShippingStoreSetter = (
  partial: Partial<AdminShippingState> | ((state: AdminShippingState) => Partial<AdminShippingState>),
) => void;

type ShippingStoreGetter = () => AdminShippingState;

async function loadShippingConfiguration(set: ShippingStoreSetter): Promise<boolean> {
  const repository = getCommerceRepository();
  const operationId = ++operationSequence;
  set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });

  try {
    const [providers, pickupPoints] = await Promise.all([
      repository.getShippingProviders(),
      repository.getPickupPoints(),
    ]);
    if (operationId !== operationSequence) return false;

    const nextProviders = providers.map(toCommerceShippingProvider);
    const nextPickupPoints = pickupPoints.map(toCommercePickupPoint);
    if (repository.source === DATA_SOURCE.MOCK) {
      nextPickupPoints.push(
        ...[...mockOnlyPickupPoints.values()]
          .filter((point) => !nextPickupPoints.some((current) => current.id === point.id))
          .map(toCommercePickupPoint),
      );
    }
    set({
      error: null,
      hasLoaded: true,
      isEmpty: nextProviders.length === 0 && nextPickupPoints.length === 0,
      pickupPoints: nextPickupPoints,
      pickupPointsEmpty: nextPickupPoints.length === 0,
      providers: nextProviders,
      providersEmpty: nextProviders.length === 0,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    });
    return true;
  } catch (error) {
    if (operationId !== operationSequence) return false;

    set({
      error: toCommerceStoreError(error, "SHIPPING_CONFIGURATION_LOAD_FAILED", "The shipping configuration could not be loaded."),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.ERROR,
    });
    return false;
  }
}

function updateProvider(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  provider: CommerceShippingProvider,
): Promise<boolean> {
  const repository = getCommerceRepository();
  const previousProviders = get().providers;
  const operationId = ++operationSequence;
  const optimisticProvider = repository.source === DATA_SOURCE.MOCK
    ? { ...provider, updatedAt: now() }
    : provider;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      providers: previousProviders.map((current) => current.id === provider.id ? optimisticProvider : current),
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.updateShippingProvider(provider.id, toShippingProviderInput(provider)).then((updated) => {
    if (operationId !== operationSequence) return false;

    const nextProvider = toCommerceShippingProvider(updated);
    set((state) => ({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      providers: state.providers.map((current) => current.id === nextProvider.id ? nextProvider : current),
      providersEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    const operationError = toCommerceStoreError(error, "SHIPPING_PROVIDER_UPDATE_FAILED", "The shipping provider could not be updated.");
    if (repository.source === DATA_SOURCE.MOCK) {
      set({ error: operationError, providers: previousProviders, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    } else {
      set({ error: operationError, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    }
    return false;
  });
}

function updateProviderStatus(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  providerId: ShippingProviderId,
  status: ShippingProviderConfig["status"],
): Promise<boolean> {
  const provider = get().providers.find((current) => current.id === providerId);
  if (!provider) return setMissingResourceError(set, "SHIPPING_PROVIDER_NOT_FOUND", "The requested shipping provider is not loaded.");

  return updateProvider(set, get, { ...provider, status });
}

function savePickupPoint(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  pickupPoint: CommercePickupPoint,
): Promise<boolean> {
  const repository = getCommerceRepository();
  if (repository.source === DATA_SOURCE.MOCK && !get().pickupPoints.some((point) => point.id === pickupPoint.id)) {
    mockOnlyPickupPoints.set(pickupPoint.id, toCommercePickupPoint(pickupPoint));
    return updateMockOnlyPickupPoint(set, get, pickupPoint);
  }

  if (repository.source === DATA_SOURCE.API && !get().pickupPoints.some((point) => point.id === pickupPoint.id)) {
    return setMissingResourceError(set, "PICKUP_POINT_CREATE_UNSUPPORTED", "New pickup points are not available through the current commerce API.");
  }

  return updatePickupPoint(set, get, pickupPoint);
}

function updatePickupPointStatus(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  pickupPointId: string,
  status: PickupPoint["status"],
): Promise<boolean> {
  const pickupPoint = get().pickupPoints.find((current) => current.id === pickupPointId);
  if (!pickupPoint) return setMissingResourceError(set, "PICKUP_POINT_NOT_FOUND", "The requested pickup point is not loaded.");

  return updatePickupPoint(set, get, { ...pickupPoint, status });
}

function updatePickupPoint(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  pickupPoint: CommercePickupPoint,
): Promise<boolean> {
  const repository = getCommerceRepository();
  if (repository.source === DATA_SOURCE.MOCK && mockOnlyPickupPoints.has(pickupPoint.id)) {
    return updateMockOnlyPickupPoint(set, get, pickupPoint);
  }

  const previousPickupPoints = get().pickupPoints;
  const operationId = ++operationSequence;
  const optimisticPoint = repository.source === DATA_SOURCE.MOCK
    ? { ...pickupPoint, updatedAt: now() }
    : pickupPoint;

  if (repository.source === DATA_SOURCE.MOCK) {
    set({
      error: null,
      hasLoaded: true,
      isEmpty: false,
      pickupPoints: replacePickupPoint(previousPickupPoints, optimisticPoint),
      pickupPointsEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.LOADING,
    });
  } else {
    set({ error: null, source: repository.source, status: COMMERCE_ASYNC_STATUS.LOADING });
  }

  return repository.updatePickupPoint(pickupPoint.id, toPickupPointInput(pickupPoint)).then((updated) => {
    if (operationId !== operationSequence) return false;

    const nextPoint = toCommercePickupPoint(updated);
    set((state) => ({
      error: null,
      hasLoaded: true,
      isEmpty: state.providers.length === 0 && state.pickupPoints.length === 0,
      pickupPoints: replacePickupPoint(state.pickupPoints, nextPoint),
      pickupPointsEmpty: false,
      source: repository.source,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    }));
    return true;
  }).catch((error: unknown) => {
    if (operationId !== operationSequence) return false;

    const operationError = toCommerceStoreError(error, "PICKUP_POINT_UPDATE_FAILED", "The pickup point could not be updated.");
    if (repository.source === DATA_SOURCE.MOCK) {
      set({ error: operationError, pickupPoints: previousPickupPoints, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    } else {
      set({ error: operationError, source: repository.source, status: COMMERCE_ASYNC_STATUS.ERROR });
    }
    return false;
  });
}

function updateMockOnlyPickupPoint(
  set: ShippingStoreSetter,
  get: ShippingStoreGetter,
  pickupPoint: CommercePickupPoint,
): Promise<boolean> {
  const nextPoint = { ...toCommercePickupPoint(pickupPoint), updatedAt: now() };
  mockOnlyPickupPoints.set(nextPoint.id, nextPoint);
  set((state) => {
    const pickupPoints = state.pickupPoints.some((point) => point.id === nextPoint.id)
      ? replacePickupPoint(state.pickupPoints, nextPoint)
      : [...state.pickupPoints, nextPoint];
    return {
      error: null,
      hasLoaded: true,
      isEmpty: state.providers.length === 0 && pickupPoints.length === 0,
      pickupPoints,
      pickupPointsEmpty: pickupPoints.length === 0,
      status: COMMERCE_ASYNC_STATUS.SUCCESS,
    };
  });
  return Promise.resolve(true);
}

function normalizeProviderConfig(config: ShippingProviderConfig): CommerceShippingProvider {
  return {
    ...config,
    enabledModalities: [...config.enabledModalities],
    origin: { ...config.origin },
    status: config.status === "active" ? "active" : "configured_inactive",
    weightRanges: config.weightRanges.map((range) => ({ ...range })),
  };
}

function normalizePickupPoint(pickupPoint: PickupPoint): CommercePickupPoint {
  return {
    ...pickupPoint,
    address: { ...pickupPoint.address },
    provinces: [...pickupPoint.provinces],
    schedule: pickupPoint.schedule.map((range) => ({ ...range })),
    status: pickupPoint.status === "active" ? "active" : "configured_inactive",
  };
}

function toCommerceShippingProvider(provider: CommerceShippingProvider): CommerceShippingProvider {
  return {
    ...provider,
    enabledModalities: [...provider.enabledModalities],
    origin: { ...provider.origin },
    weightRanges: provider.weightRanges.map((range) => ({ ...range })),
  };
}

function toCommercePickupPoint(pickupPoint: CommercePickupPoint): CommercePickupPoint {
  return {
    ...pickupPoint,
    address: { ...pickupPoint.address },
    provinces: [...pickupPoint.provinces],
    schedule: pickupPoint.schedule.map((range) => ({ ...range })),
  };
}

function initialPickupPointsFromStatic(): CommercePickupPoint[] {
  return initialPickupPoints.map(normalizeStaticPickupPoint);
}

function normalizeStaticPickupPoint(pickupPoint: PickupPoint): CommercePickupPoint {
  return normalizePickupPoint(pickupPoint);
}

function toShippingProviderInput(provider: CommerceShippingProvider): UpdateShippingProviderDTO {
  return {
    enabledModalities: [...provider.enabledModalities],
    ...(provider.freeShippingThreshold === undefined ? {} : { freeShippingThreshold: provider.freeShippingThreshold }),
    origin: { ...provider.origin },
    status: provider.status,
    weightRanges: provider.weightRanges.map((range) => ({ ...range })),
  };
}

function toPickupPointInput(pickupPoint: CommercePickupPoint): UpdatePickupPointDTO {
  return {
    address: { ...pickupPoint.address },
    ...(pickupPoint.contactEmail === undefined ? {} : { contactEmail: pickupPoint.contactEmail }),
    ...(pickupPoint.contactName === undefined ? {} : { contactName: pickupPoint.contactName }),
    ...(pickupPoint.contactPhone === undefined ? {} : { contactPhone: pickupPoint.contactPhone }),
    costType: pickupPoint.costType,
    coverageType: pickupPoint.coverageType,
    ...(pickupPoint.fixedCost === undefined ? {} : { fixedCost: pickupPoint.fixedCost }),
    isMain: pickupPoint.isMain,
    name: pickupPoint.name,
    preparationHours: pickupPoint.preparationHours,
    provinces: [...pickupPoint.provinces],
    schedule: pickupPoint.schedule.map((range) => ({ ...range })),
    status: pickupPoint.status,
  };
}

function replacePickupPoint(
  pickupPoints: CommercePickupPoint[],
  updated: CommercePickupPoint,
): CommercePickupPoint[] {
  return pickupPoints.map((current) => {
    if (current.id === updated.id) return toCommercePickupPoint(updated);
    return updated.isMain ? { ...current, isMain: false } : current;
  });
}

function setMissingResourceError(
  set: ShippingStoreSetter,
  code: string,
  message: string,
): Promise<boolean> {
  set({
    error: toCommerceStoreError(new Error(message), code, message),
    status: COMMERCE_ASYNC_STATUS.ERROR,
  });
  return Promise.resolve(false);
}

function now(): string {
  return new Date().toISOString();
}
