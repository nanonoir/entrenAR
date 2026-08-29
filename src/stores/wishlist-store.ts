"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AccountApiError, toAccountApiError } from "@/lib/api/account/client";
import { getAccountRepository } from "@/lib/api/account/account.repository";
import { DATA_SOURCE, getAccountDataSource } from "@/lib/api/config";
import { normalizeAccountEmail } from "@/lib/account-validation";
import {
  ACCOUNT_ASYNC_STATUS,
  type AccountAsyncStatus,
  type AccountOperationError,
  type WishlistProductId,
} from "@/types/account";

type WishlistState = {
  activeUserEmail: string | null;
  bootstrap: (email: string) => Promise<boolean>;
  clearError: () => void;
  error: AccountOperationError | null;
  guestProductIds: WishlistProductId[];
  hasProduct: (productId: WishlistProductId) => boolean;
  legacyProductIds: WishlistProductId[];
  load: (email: string) => Promise<boolean>;
  pendingProductIds: WishlistProductId[];
  productIds: WishlistProductId[];
  reconciledByEmail: Record<string, boolean>;
  setActiveUser: (email: string | null) => void;
  status: AccountAsyncStatus;
  addProduct: (productId: WishlistProductId, email?: string) => Promise<boolean>;
  removeProduct: (productId: WishlistProductId, email?: string) => Promise<boolean>;
  toggleProduct: (productId: WishlistProductId, email?: string) => Promise<boolean>;
};

type PersistedWishlistState = Pick<
  WishlistState,
  "guestProductIds" | "legacyProductIds" | "productIds" | "reconciledByEmail"
>;

const bootstrapPromises = new Map<string, Promise<boolean>>();

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      activeUserEmail: null,
      bootstrap: (email) => bootstrapWishlist(email, set, get),
      clearError: () => set({ error: null }),
      error: null,
      guestProductIds: [],
      hasProduct: (productId) => get().productIds.includes(productId),
      legacyProductIds: [],
      load: (email) => bootstrapWishlist(email, set, get, true),
      pendingProductIds: [],
      productIds: [],
      reconciledByEmail: {},
      setActiveUser: (email) => {
        const normalizedEmail = email ? normalizeAccountEmail(email) : null;

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          set({ activeUserEmail: normalizedEmail });
          return;
        }

        const state = get();
        if (state.activeUserEmail === normalizedEmail) {
          return;
        }

        if (!normalizedEmail) {
          const guestProductIds = uniqueProductIds(
            state.activeUserEmail
              ? state.guestProductIds
              : state.guestProductIds.length > 0
                ? state.guestProductIds
                : state.productIds,
          );
          set({
            activeUserEmail: null,
            error: null,
            pendingProductIds: [],
            productIds: guestProductIds,
            status: ACCOUNT_ASYNC_STATUS.IDLE,
          });
          return;
        }

        const guestProductIds = uniqueProductIds(
          state.activeUserEmail ? state.guestProductIds : state.productIds,
        );
        set({
          activeUserEmail: normalizedEmail,
          error: null,
          guestProductIds,
          legacyProductIds: state.legacyProductIds.length > 0
            ? state.legacyProductIds
            : guestProductIds,
          pendingProductIds: [],
          productIds: [],
          status: ACCOUNT_ASYNC_STATUS.IDLE,
        });
      },
      status: ACCOUNT_ASYNC_STATUS.IDLE,
      addProduct: async (productId, email) => {
        const activeEmail = activateUserForAction(email, get);

        if (getAccountDataSource() !== DATA_SOURCE.API || !activeEmail) {
          set((state) => ({
            error: null,
            guestProductIds: state.guestProductIds.includes(productId)
              ? state.guestProductIds
              : [...state.guestProductIds, productId],
            productIds: state.productIds.includes(productId)
              ? state.productIds
              : [...state.productIds, productId],
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          }));
          return true;
        }

        setPendingProduct(set, productId, true);
        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await getAccountRepository(DATA_SOURCE.API).addToWishlist(productId);

          if (get().activeUserEmail !== activeEmail) {
            return false;
          }

          set((state) => ({
            error: null,
            pendingProductIds: state.pendingProductIds.filter((item) => item !== productId),
            productIds: state.productIds.includes(productId)
              ? state.productIds
              : [...state.productIds, productId],
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === activeEmail) {
            setWishlistError(set, error);
          }
          return false;
        } finally {
          if (get().activeUserEmail === activeEmail) {
            removePendingProduct(set, productId);
          }
        }
      },
      removeProduct: async (productId, email) => {
        const activeEmail = activateUserForAction(email, get);

        if (getAccountDataSource() !== DATA_SOURCE.API || !activeEmail) {
          set((state) => ({
            error: null,
            guestProductIds: state.guestProductIds.filter((item) => item !== productId),
            productIds: state.productIds.filter((item) => item !== productId),
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          }));
          return true;
        }

        setPendingProduct(set, productId, true);
        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await getAccountRepository(DATA_SOURCE.API).removeFromWishlist(productId);

          if (get().activeUserEmail !== activeEmail) {
            return false;
          }

          set((state) => ({
            error: null,
            pendingProductIds: state.pendingProductIds.filter((item) => item !== productId),
            productIds: state.productIds.filter((item) => item !== productId),
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === activeEmail) {
            setWishlistError(set, error);
          }
          return false;
        } finally {
          if (get().activeUserEmail === activeEmail) {
            removePendingProduct(set, productId);
          }
        }
      },
      toggleProduct: async (productId, email) => {
        const activeEmail = activateUserForAction(email, get);
        const isActive = get().productIds.includes(productId);

        if (isActive) {
          return get().removeProduct(productId, activeEmail ?? undefined);
        }

        return get().addProduct(productId, activeEmail ?? undefined);
      },
    }),
    {
      merge: (persistedState, currentState) => mergePersistedState(persistedState, currentState),
      name: "entrenar-wishlist-preview",
      partialize: (state): PersistedWishlistState => {
        if (getAccountDataSource() === DATA_SOURCE.API) {
          return {
            guestProductIds: state.guestProductIds,
            legacyProductIds: state.legacyProductIds,
            productIds: [],
            reconciledByEmail: state.reconciledByEmail,
          };
        }

        return {
          guestProductIds: state.productIds,
          legacyProductIds: [],
          productIds: state.productIds,
          reconciledByEmail: {},
        };
      },
      skipHydration: true,
    },
  ),
);

async function bootstrapWishlist(
  email: string,
  set: (partial: Partial<WishlistState> | ((state: WishlistState) => Partial<WishlistState>)) => void,
  get: () => WishlistState,
  forceReload = false,
): Promise<boolean> {
  const normalizedEmail = normalizeAccountEmail(email);

  if (getAccountDataSource() !== DATA_SOURCE.API) {
    set({ activeUserEmail: normalizedEmail, error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
    return true;
  }

  if (get().activeUserEmail !== normalizedEmail) {
    get().setActiveUser(normalizedEmail);
  }

  if (!forceReload && get().reconciledByEmail[normalizedEmail] && get().status === ACCOUNT_ASYNC_STATUS.SUCCESS) {
    return true;
  }

  const pending = bootstrapPromises.get(normalizedEmail);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

    try {
      const repository = getAccountRepository(DATA_SOURCE.API);
      let products = await repository.listWishlist();

      if (get().activeUserEmail !== normalizedEmail) {
        return false;
      }

      const stateBeforeReconciliation = get();
      const alreadyReconciled = stateBeforeReconciliation.reconciledByEmail[normalizedEmail] === true;

      if (!alreadyReconciled) {
        if (products.length === 0 && stateBeforeReconciliation.legacyProductIds.length > 0) {
          for (const productId of stateBeforeReconciliation.legacyProductIds) {
            if (get().activeUserEmail !== normalizedEmail) {
              return false;
            }

            try {
              await repository.addToWishlist(productId);
            } catch (error) {
              if (!isIgnorableLegacyError(error)) {
                throw error;
              }
            }
          }

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          products = await repository.listWishlist();
        }

        set((state) => ({
          legacyProductIds: [],
          reconciledByEmail: {
            ...state.reconciledByEmail,
            [normalizedEmail]: true,
          },
        }));
      }

      if (get().activeUserEmail !== normalizedEmail) {
        return false;
      }

      set({
        error: null,
        pendingProductIds: [],
        productIds: products.map((product) => product.id),
        status: ACCOUNT_ASYNC_STATUS.SUCCESS,
      });
      return true;
    } catch (error) {
      if (get().activeUserEmail === normalizedEmail) {
        setWishlistError(
          set,
          error,
          "WISHLIST_BOOTSTRAP_FAILED",
          "The wishlist could not be loaded.",
        );
      }
      return false;
    } finally {
      bootstrapPromises.delete(normalizedEmail);
    }
  })();

  bootstrapPromises.set(normalizedEmail, promise);
  return promise;
}

function activateUserForAction(
  email: string | undefined,
  get: () => WishlistState,
): string | null {
  if (getAccountDataSource() !== DATA_SOURCE.API) {
    return null;
  }

  const normalizedEmail = email ? normalizeAccountEmail(email) : get().activeUserEmail;
  if (normalizedEmail && get().activeUserEmail !== normalizedEmail) {
    get().setActiveUser(normalizedEmail);
  }

  return normalizedEmail ?? null;
}

function setPendingProduct(
  set: (partial: Partial<WishlistState> | ((state: WishlistState) => Partial<WishlistState>)) => void,
  productId: string,
  pending: boolean,
): void {
  set((state) => ({
    pendingProductIds: pending
      ? state.pendingProductIds.includes(productId)
        ? state.pendingProductIds
        : [...state.pendingProductIds, productId]
      : state.pendingProductIds.filter((item) => item !== productId),
  }));
}

function removePendingProduct(
  set: (partial: Partial<WishlistState> | ((state: WishlistState) => Partial<WishlistState>)) => void,
  productId: string,
): void {
  setPendingProduct(set, productId, false);
}

function setWishlistError(
  set: (partial: Partial<WishlistState> | ((state: WishlistState) => Partial<WishlistState>)) => void,
  error: unknown,
  fallbackCode = "WISHLIST_OPERATION_FAILED",
  fallbackMessage = "The wishlist operation could not be completed.",
): void {
  const operationError = toAccountApiError(error, fallbackCode, fallbackMessage);
  set({ error: operationError, status: ACCOUNT_ASYNC_STATUS.ERROR });
}

function isIgnorableLegacyError(error: unknown): boolean {
  return error instanceof AccountApiError && [400, 404, 409].includes(error.status);
}

function mergePersistedState(
  persistedState: unknown,
  currentState: WishlistState,
): WishlistState {
  const persisted = isRecord(persistedState) ? persistedState : {};
  const persistedProductIds = readProductIds(persisted.productIds);
  const persistedGuestProductIds = readProductIds(persisted.guestProductIds);
  const legacyProductIds = readProductIds(persisted.legacyProductIds);
  const reconciledByEmail = readBooleans(persisted.reconciledByEmail);
  const guestProductIds = persistedGuestProductIds ?? persistedProductIds ?? [];
  const rollbackProductIds = uniqueProductIds([
    ...guestProductIds,
    ...(legacyProductIds ?? []),
  ]);

  if (getAccountDataSource() === DATA_SOURCE.API) {
    if (currentState.activeUserEmail) {
      return currentState;
    }

    return {
      ...currentState,
      activeUserEmail: null,
      guestProductIds,
      legacyProductIds: legacyProductIds ?? persistedProductIds ?? [],
      pendingProductIds: [],
      productIds: guestProductIds,
      reconciledByEmail,
      status: ACCOUNT_ASYNC_STATUS.IDLE,
    };
  }

  return {
    ...currentState,
    activeUserEmail: null,
    guestProductIds: rollbackProductIds,
    legacyProductIds: [],
    pendingProductIds: [],
    productIds: rollbackProductIds,
    reconciledByEmail: {},
    status: ACCOUNT_ASYNC_STATUS.IDLE,
  };
}

function readProductIds(value: unknown): WishlistProductId[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return uniqueProductIds(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
}

function readBooleans(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, boolean>>((result, [email, isReconciled]) => {
    if (typeof isReconciled === "boolean") {
      result[email] = isReconciled;
    }
    return result;
  }, {});
}

function uniqueProductIds(productIds: WishlistProductId[]): WishlistProductId[] {
  return [...new Set(productIds)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
