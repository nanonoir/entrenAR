"use client";

import { create } from "zustand";
import { abandonedCartsRepository } from "@/lib/api/config";
import { AbandonedCartsApiError } from "@/lib/api/admin/abandoned-carts/client";
import { MockAbandonedCartsRepository } from "@/lib/api/admin/abandoned-carts/mock-abandoned-carts-repository";
import type { AbandonedCartsRepository } from "@/lib/api/admin/abandoned-carts/repository";
import {
  RECOVERY_STATUS,
  type AbandonedCartDetail,
  type AbandonedCartListItem,
  type AbandonedCartListQuery,
  type AbandonedCartSummaryStats,
  type AbandonedCartsDataSource,
  type AbandonedCartRecoveryLink,
  type CheckoutSessionHistoryEvent,
  type RecoveryActionResult,
  type RecoveryConfig,
  type RecoveryEmailTemplate,
  type RecoveryStatus,
} from "@/lib/api/admin/abandoned-carts/types";
import {
  mockAbandonedCarts,
  mockRecoveryConfig,
  mockRecoveryEmailTemplate,
} from "@/lib/data/admin/sales-flow/abandonedCarts";
import type {
  AbandonedCart as LegacyAbandonedCart,
  AbandonedCartRecoveryStatus as LegacyRecoveryStatus,
} from "@/lib/data/admin/sales-flow/types";

const OPERATION_CATEGORY = {
  DETAIL: "detail",
  LOADING: "loading",
  MUTATION: "mutation",
} as const;

type OperationCategory = (typeof OPERATION_CATEGORY)[keyof typeof OPERATION_CATEGORY];

const FALLBACK_MESSAGE = "The abandoned-carts API is unavailable. Showing local data until it recovers.";

export interface AbandonedCartsPagination {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface LastRecoveryLink {
  cartId: string;
  recoveryUrl: string;
}

export type AbandonedCartsSummary = AbandonedCartSummaryStats;

export type AdminAbandonedCartsState = {
  carts: AbandonedCartListItem[];
  selectedCart: AbandonedCartDetail | null;
  config: RecoveryConfig;
  template: RecoveryEmailTemplate;
  summary: AbandonedCartsSummary | null;
  pagination: AbandonedCartsPagination | null;
  filters: AbandonedCartListQuery;
  isLoading: boolean;
  isDetailLoading: boolean;
  isMutating: boolean;
  error: string | null;
  lastRecoveryLink: LastRecoveryLink | null;

  source: AbandonedCartsDataSource;
  hasLoaded: boolean;
  isFallback: boolean;
  fallbackMessage: string | null;

  fetchCarts: (query?: AbandonedCartListQuery) => Promise<boolean>;
  fetchCartById: (id: string) => Promise<AbandonedCartDetail | null>;
  sendRecoveryEmail: (cartId: string, note?: string) => Promise<RecoveryActionResult | null>;
  markManualRecovery: (cartId: string, notes?: string) => Promise<RecoveryActionResult | null>;
  convertCart: (cartId: string) => Promise<RecoveryActionResult | null>;
  discardCart: (cartId: string, reason: string) => Promise<RecoveryActionResult | null>;
  fetchConfig: () => Promise<RecoveryConfig | null>;
  updateConfig: (config: Partial<RecoveryConfig>) => Promise<RecoveryConfig | null>;
  fetchTemplate: () => Promise<RecoveryEmailTemplate | null>;
  updateTemplate: (template: Partial<RecoveryEmailTemplate>) => Promise<RecoveryEmailTemplate | null>;
  setFilters: (filters: Partial<AbandonedCartListQuery>) => void;
  clearError: () => void;
  selectCart: (cart: AbandonedCartDetail | null) => void;
  retryLoad: () => Promise<boolean>;
};

interface OperationHandle {
  category: OperationCategory;
  key: string;
  token: string;
  version: number;
}

interface CartMutationOptions {
  clearRecoveryLink?: boolean;
  lastEmailSentAt?: string;
}

const LEGACY_STATUS_TO_API: Record<LegacyRecoveryStatus, RecoveryStatus> = {
  manual: RECOVERY_STATUS.MANUAL,
  pending: RECOVERY_STATUS.PENDING,
  recovered: RECOVERY_STATUS.RECOVERED,
  sent: RECOVERY_STATUS.SENT,
};

function now(): string {
  return new Date().toISOString();
}

function cloneRecoveryLink(link: AbandonedCartRecoveryLink | null | undefined): AbandonedCartRecoveryLink | null | undefined {
  return link ? { ...link } : link;
}

function cloneLastRecoveryLink(link: LastRecoveryLink | null): LastRecoveryLink | null {
  return link ? { ...link } : null;
}

function cloneHistoryEvent(event: CheckoutSessionHistoryEvent): CheckoutSessionHistoryEvent {
  return {
    ...event,
    ...(event.metadata ? { metadata: { ...event.metadata } } : {}),
  };
}

function cloneListItem(cart: AbandonedCartListItem): AbandonedCartListItem {
  return {
    abandonedAt: cart.abandonedAt,
    customer: { ...cart.customer },
    id: cart.id,
    ...(cart.lastEmailSentAt === undefined ? {} : { lastEmailSentAt: cart.lastEmailSentAt }),
    products: cart.products.map((product) => ({ ...product })),
    recoveryStatus: cart.recoveryStatus,
    total: cart.total,
  };
}

function cloneDetail(cart: AbandonedCartDetail | null): AbandonedCartDetail | null {
  if (!cart) return null;
  return {
    ...cloneListItem(cart),
    cartId: cart.cartId,
    items: cart.items.map((product) => ({ ...product })),
    ...(cart.recoveryExpiresAt === undefined ? {} : { recoveryExpiresAt: cart.recoveryExpiresAt }),
    ...(cart.recoveryLink === undefined ? {} : { recoveryLink: cloneRecoveryLink(cart.recoveryLink) }),
    timeline: cart.timeline.map(cloneHistoryEvent),
  };
}

function cloneConfig(config: RecoveryConfig): RecoveryConfig {
  return { ...config };
}

function cloneTemplate(template: RecoveryEmailTemplate): RecoveryEmailTemplate {
  return { ...template };
}

function toListItem(cart: LegacyAbandonedCart): AbandonedCartListItem {
  return {
    abandonedAt: cart.abandonedAt,
    customer: {
      firstName: cart.customer.firstName,
      lastName: cart.customer.lastName,
      ...(cart.customer.dniOrCuil ? { dni: cart.customer.dniOrCuil } : {}),
      ...(cart.customer.email === undefined ? {} : { email: cart.customer.email }),
      ...(cart.customer.phone === undefined ? {} : { phone: cart.customer.phone }),
    },
    id: cart.id,
    ...(cart.lastEmailSentAt === undefined ? {} : { lastEmailSentAt: cart.lastEmailSentAt }),
    products: cart.products.map((product) => ({
      lineSubtotal: product.quantity * product.unitPrice,
      name: product.name,
      productId: product.productId,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      ...(product.variantId === undefined ? {} : { variantId: product.variantId }),
    })),
    recoveryStatus: LEGACY_STATUS_TO_API[cart.recoveryStatus],
    total: cart.total,
  };
}

function summarize(carts: readonly AbandonedCartListItem[]): AbandonedCartsSummary {
  return {
    pendingCount: carts.filter((cart) => cart.recoveryStatus === RECOVERY_STATUS.PENDING).length,
    recoverableTotal: carts
      .filter((cart) => cart.recoveryStatus !== RECOVERY_STATUS.RECOVERED && cart.recoveryStatus !== RECOVERY_STATUS.DISCARDED)
      .reduce((total, cart) => total + cart.total, 0),
    recoveredCount: carts.filter((cart) => cart.recoveryStatus === RECOVERY_STATUS.RECOVERED).length,
  };
}

function initialPagination(carts: readonly AbandonedCartListItem[]): AbandonedCartsPagination | null {
  if (carts.length === 0) return null;
  return { limit: 20, page: 1, total: carts.length, totalPages: 1 };
}

function upsertCart(carts: readonly AbandonedCartListItem[], cart: AbandonedCartListItem): AbandonedCartListItem[] {
  const nextCart = cloneListItem(cart);
  const index = carts.findIndex((current) => current.id === cart.id);
  if (index < 0) return [...carts.map(cloneListItem), nextCart];
  return carts.map((current, currentIndex) => currentIndex === index ? nextCart : cloneListItem(current));
}

function reconcileSelectedCart(
  selectedCart: AbandonedCartDetail | null,
  cart: AbandonedCartListItem,
  recoveryLink: AbandonedCartRecoveryLink | null | undefined,
  clearRecoveryLink: boolean,
): AbandonedCartDetail | null {
  if (!selectedCart || selectedCart.id !== cart.id) return selectedCart;
  const next = {
    ...cloneDetail(selectedCart),
    ...cloneListItem(cart),
    cartId: selectedCart.cartId,
    items: selectedCart.items.map((product) => ({ ...product })),
    timeline: selectedCart.timeline.map(cloneHistoryEvent),
  } as AbandonedCartDetail;
  if (recoveryLink !== undefined) {
    next.recoveryLink = cloneRecoveryLink(recoveryLink);
    next.recoveryExpiresAt = recoveryLink?.expiresAt ?? null;
  } else if (clearRecoveryLink) {
    next.recoveryLink = null;
    next.recoveryExpiresAt = null;
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFallbackEligible(repository: AbandonedCartsRepository, error: unknown): boolean {
  if (repository.source !== "api") return false;
  if (error instanceof AbandonedCartsApiError) return error.status >= 500;
  if (error instanceof TypeError) return true;
  const value = isRecord(error) ? error : {};
  const status = typeof value.status === "number" ? value.status : 0;
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : error instanceof Error ? error.message : "";
  return status >= 500 || code === "ABANDONED_CARTS_API_UNAVAILABLE" || /fetch|network|offline|unavailable/i.test(message);
}

function toStoreError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message;
  return "The abandoned-cart operation could not be completed.";
}

export function createAdminAbandonedCartsStore(
  repository: AbandonedCartsRepository = abandonedCartsRepository,
  fallbackRepository: AbandonedCartsRepository = new MockAbandonedCartsRepository(),
) {
  const configuredRepository = repository;
  let activeRepository = configuredRepository;
  const operationVersions = new Map<string, number>();
  const loadingOperations = new Set<string>();
  const detailOperations = new Set<string>();
  const mutationOperations = new Set<string>();

  return create<AdminAbandonedCartsState>()((set, get) => {
    const beginOperation = (category: OperationCategory, key: string): OperationHandle => {
      const version = (operationVersions.get(key) ?? 0) + 1;
      const token = `${key}:${version}`;
      operationVersions.set(key, version);
      if (category === OPERATION_CATEGORY.DETAIL) detailOperations.add(token);
      if (category === OPERATION_CATEGORY.LOADING) loadingOperations.add(token);
      if (category === OPERATION_CATEGORY.MUTATION) mutationOperations.add(token);
      set({
        error: null,
        ...(category === OPERATION_CATEGORY.DETAIL ? { isDetailLoading: true } : {}),
        ...(category === OPERATION_CATEGORY.LOADING ? { isLoading: true } : {}),
        ...(category === OPERATION_CATEGORY.MUTATION ? { isMutating: true } : {}),
      });
      return { category, key, token, version };
    };

    const finishOperation = (operation: OperationHandle): void => {
      if (operation.category === OPERATION_CATEGORY.DETAIL) detailOperations.delete(operation.token);
      if (operation.category === OPERATION_CATEGORY.LOADING) loadingOperations.delete(operation.token);
      if (operation.category === OPERATION_CATEGORY.MUTATION) mutationOperations.delete(operation.token);
      set({
        ...(operation.category === OPERATION_CATEGORY.DETAIL ? { isDetailLoading: detailOperations.size > 0 } : {}),
        ...(operation.category === OPERATION_CATEGORY.LOADING ? { isLoading: loadingOperations.size > 0 } : {}),
        ...(operation.category === OPERATION_CATEGORY.MUTATION ? { isMutating: mutationOperations.size > 0 } : {}),
      });
    };

    const isCurrentOperation = (key: string, version: number): boolean => operationVersions.get(key) === version;

    const activateFallback = (): void => {
      activeRepository = fallbackRepository;
      set({
        fallbackMessage: FALLBACK_MESSAGE,
        isFallback: true,
        source: fallbackRepository.source,
      });
    };

    const runWithFallback = async <T>(operation: (active: AbandonedCartsRepository) => Promise<T>): Promise<T> => {
      try {
        return await operation(activeRepository);
      } catch (error) {
        if (!isFallbackEligible(activeRepository, error)) throw error;
        activateFallback();
        return operation(activeRepository);
      }
    };

    const runOperation = async <T>(
      category: OperationCategory,
      key: string,
      operation: (active: AbandonedCartsRepository) => Promise<T>,
      commit: (result: T) => void,
      rollback?: () => void,
    ): Promise<T | null> => {
      const handle = beginOperation(category, key);
      try {
        const result = await runWithFallback(operation);
        if (isCurrentOperation(key, handle.version)) {
          commit(result);
          set({ error: null });
        }
        return result;
      } catch (error) {
        if (isCurrentOperation(key, handle.version)) {
          rollback?.();
          set({ error: toStoreError(error) });
        }
        return null;
      } finally {
        finishOperation(handle);
      }
    };

    const mutateCart = (
      cartId: string,
      targetStatus: RecoveryStatus,
      operation: (active: AbandonedCartsRepository) => Promise<RecoveryActionResult>,
      options: CartMutationOptions = {},
    ): Promise<RecoveryActionResult | null> => {
      const previousCart = get().carts.find((cart) => cart.id === cartId);
      const previousSelectedCart = get().selectedCart;
      const previousLastRecoveryLink = get().lastRecoveryLink;
      const optimisticTimestamp = options.lastEmailSentAt;

      set((state) => ({
        carts: state.carts.map((cart) => cart.id === cartId
          ? {
            ...cart,
            recoveryStatus: targetStatus,
            ...(optimisticTimestamp ? { lastEmailSentAt: optimisticTimestamp } : {}),
          }
          : cart),
        error: null,
        ...(options.clearRecoveryLink && state.lastRecoveryLink?.cartId === cartId ? { lastRecoveryLink: null } : {}),
        selectedCart: state.selectedCart?.id === cartId
          ? {
            ...state.selectedCart,
            recoveryStatus: targetStatus,
            ...(optimisticTimestamp ? { lastEmailSentAt: optimisticTimestamp } : {}),
            ...(options.clearRecoveryLink ? { recoveryExpiresAt: null, recoveryLink: null } : {}),
          }
          : state.selectedCart,
      }));

      return runOperation(
        OPERATION_CATEGORY.MUTATION,
        `cart:${cartId}`,
        operation,
        (result) => set((state) => ({
          carts: upsertCart(state.carts, result.cart),
          lastRecoveryLink: result.recoveryLink !== undefined
            ? result.recoveryLink === null
              ? null
              : { cartId, recoveryUrl: result.recoveryLink.url }
            : options.clearRecoveryLink && state.lastRecoveryLink?.cartId === cartId
              ? null
              : state.lastRecoveryLink,
          selectedCart: reconcileSelectedCart(state.selectedCart, result.cart, result.recoveryLink, options.clearRecoveryLink === true),
        })),
        () => set((state) => ({
          carts: previousCart
            ? state.carts.some((cart) => cart.id === cartId)
              ? state.carts.map((cart) => cart.id === cartId ? cloneListItem(previousCart) : cart)
              : [...state.carts, cloneListItem(previousCart)]
            : state.carts,
          lastRecoveryLink: options.clearRecoveryLink && state.lastRecoveryLink?.cartId === cartId
            ? cloneLastRecoveryLink(previousLastRecoveryLink)
            : state.lastRecoveryLink,
          selectedCart: state.selectedCart?.id === cartId ? cloneDetail(previousSelectedCart) : state.selectedCart,
        })),
      );
    };

    const initialCarts = configuredRepository.source === "mock" ? mockAbandonedCarts.map(toListItem) : [];

    return {
      carts: initialCarts,
      selectedCart: null,
      config: cloneConfig(mockRecoveryConfig),
      template: cloneTemplate(mockRecoveryEmailTemplate),
      summary: initialCarts.length > 0 ? summarize(initialCarts) : null,
      pagination: initialPagination(initialCarts),
      filters: {},
      isLoading: false,
      isDetailLoading: false,
      isMutating: false,
      error: null,
      lastRecoveryLink: null,
      source: configuredRepository.source,
      hasLoaded: configuredRepository.source === "mock",
      isFallback: false,
      fallbackMessage: null,

      fetchCarts: (query?: AbandonedCartListQuery) => {
        const nextFilters = query === undefined ? { ...get().filters } : { ...query };
        set({ filters: nextFilters });
        return runOperation(
          OPERATION_CATEGORY.LOADING,
          "carts:list",
          (active) => active.list(nextFilters),
          (result) => set({
            carts: result.items.map(cloneListItem),
            hasLoaded: true,
            pagination: {
              limit: result.limit,
              page: result.page,
              total: result.total,
              totalPages: result.totalPages,
            },
            summary: { ...result.summary },
          }),
        ).then((result) => result !== null);
      },

      fetchCartById: (id: string) => runOperation(
        OPERATION_CATEGORY.DETAIL,
        `cart:detail:${id}`,
        (active) => active.getById(id),
        (result) => set({ selectedCart: cloneDetail(result) }),
      ),

      sendRecoveryEmail: (cartId: string, note?: string) => mutateCart(
        cartId,
        RECOVERY_STATUS.SENT,
        (active) => active.sendRecoveryEmail(cartId, note),
        { lastEmailSentAt: now() },
      ),

      markManualRecovery: (cartId: string, notes?: string) => mutateCart(
        cartId,
        RECOVERY_STATUS.MANUAL,
        (active) => active.markManualRecovery(cartId, notes),
        { clearRecoveryLink: true },
      ),

      convertCart: (cartId: string) => mutateCart(
        cartId,
        RECOVERY_STATUS.RECOVERED,
        (active) => active.convertCart(cartId),
        { clearRecoveryLink: true },
      ),

      discardCart: (cartId: string, reason: string) => mutateCart(
        cartId,
        RECOVERY_STATUS.DISCARDED,
        (active) => active.discardCart(cartId, reason),
        { clearRecoveryLink: true },
      ),

      fetchConfig: () => runOperation(
        OPERATION_CATEGORY.LOADING,
        "config",
        (active) => active.getConfig(),
        (result) => set({ config: cloneConfig(result) }),
      ),

      updateConfig: (config: Partial<RecoveryConfig>) => {
        const previousConfig = cloneConfig(get().config);
        set((state) => ({ config: { ...state.config, ...config }, error: null }));
        return runOperation(
          OPERATION_CATEGORY.MUTATION,
          "config",
          (active) => active.updateConfig(config),
          (result) => set({ config: cloneConfig(result) }),
          () => set({ config: previousConfig }),
        );
      },

      fetchTemplate: () => runOperation(
        OPERATION_CATEGORY.LOADING,
        "template",
        (active) => active.getTemplate(),
        (result) => set({ template: cloneTemplate(result) }),
      ),

      updateTemplate: (template: Partial<RecoveryEmailTemplate>) => {
        const previousTemplate = cloneTemplate(get().template);
        set((state) => ({ template: { ...state.template, ...template }, error: null }));
        return runOperation(
          OPERATION_CATEGORY.MUTATION,
          "template",
          (active) => active.updateTemplate(template),
          (result) => set({ template: cloneTemplate(result) }),
          () => set({ template: previousTemplate }),
        );
      },

      setFilters: (filters: Partial<AbandonedCartListQuery>) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      clearError: () => set({ error: null }),
      selectCart: (cart: AbandonedCartDetail | null) => set({ selectedCart: cloneDetail(cart) }),
      retryLoad: async () => {
        activeRepository = configuredRepository;
        set({
          error: null,
          fallbackMessage: null,
          isFallback: false,
          source: configuredRepository.source,
        });
        return get().fetchCarts(get().filters);
      },
    } satisfies AdminAbandonedCartsState;
  });
}

export const useAdminAbandonedCartsStore = createAdminAbandonedCartsStore();
