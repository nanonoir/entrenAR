"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clearAccountAccessToken,
  toAccountApiError,
} from "@/lib/api/account/client";
import { getAccountRepository } from "@/lib/api/account/account.repository";
import { DATA_SOURCE, getAccountDataSource } from "@/lib/api/config";
import { normalizeAccountEmail } from "@/lib/account-validation";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import {
  ACCOUNT_ASYNC_STATUS,
  ACCOUNT_ROLE,
  type AccountAsyncStatus,
  type AccountOperationError,
  type AccountUser,
  type PasswordChangeInput,
  type PasswordResetInput,
  type AuthSession,
} from "@/types/account";

export type AuthState = {
  bootstrap: () => Promise<boolean>;
  changePassword: (input: PasswordChangeInput) => Promise<boolean>;
  clearError: () => void;
  error: AccountOperationError | null;
  forgotPassword: (email: string) => Promise<boolean>;
  isBootstrapped: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
  register: (email: string, password?: string) => Promise<boolean>;
  resetPassword: (input: PasswordResetInput) => Promise<boolean>;
  status: AccountAsyncStatus;
  user: AccountUser | null;
};

type PersistedAuthState = Pick<AuthState, "user">;

let bootstrapPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      bootstrap: () => bootstrapAuth(set, get),
      changePassword: async (input) => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await getAccountRepository(DATA_SOURCE.API).changePassword(input);
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        } catch (error) {
          setAuthError(set, error, "AUTH_PASSWORD_CHANGE_FAILED", "The password could not be changed.");
          return false;
        }
      },
      clearError: () => set({ error: null }),
      error: null,
      forgotPassword: async (email) => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await getAccountRepository(DATA_SOURCE.API).forgotPassword(normalizeAccountEmail(email));
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        } catch (error) {
          setAuthError(set, error, "AUTH_FORGOT_PASSWORD_FAILED", "The recovery request could not be completed.");
          return false;
        }
      },
      isBootstrapped: false,
      login: async (email, password) => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          useCartStore.getState().detachAuthenticatedUser();
          set({
            error: null,
            isBootstrapped: true,
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
            user: createMockUser(email),
          });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          const session = await getAccountRepository(DATA_SOURCE.API).login({
            email: normalizeAccountEmail(email),
            password: password ?? "",
          });
          setAuthenticatedUser(set, session);
          void bootstrapAccountStores(session.user);
          return true;
        } catch (error) {
          setAuthError(set, error, "AUTH_LOGIN_FAILED", "The account could not be signed in.");
          return false;
        }
      },
      logout: async () => {
        const currentUser = get().user;

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          useCartStore.getState().detachAuthenticatedUser();
          set({
            error: null,
            isBootstrapped: true,
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
            user: null,
          });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await useCartStore.getState().syncBeforeLogout();
          await getAccountRepository(DATA_SOURCE.API).logout();
          clearAuthenticatedStores(currentUser);
          set({
            error: null,
            isBootstrapped: true,
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
            user: null,
          });
          return true;
        } catch (error) {
          clearAuthenticatedStores(currentUser);
          setAuthError(set, error, "AUTH_LOGOUT_FAILED", "The account session could not be closed.");
          set({ isBootstrapped: true, user: null });
          return false;
        }
      },
      refresh: async () => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          const isAuthenticated = Boolean(get().user);
          set({
            error: null,
            isBootstrapped: true,
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          });
          return isAuthenticated;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          const session = await getAccountRepository(DATA_SOURCE.API).refresh();
          setAuthenticatedUser(set, session);
          void bootstrapAccountStores(session.user);
          return true;
        } catch (error) {
          const previousUser = get().user;
          setAuthError(set, error, "AUTH_REFRESH_FAILED", "The account session could not be refreshed.");
          clearAccountAccessToken();
          set({ isBootstrapped: true, user: null });
          clearAuthenticatedStores(previousUser);
          return false;
        }
      },
      register: async (email, password) => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          useCartStore.getState().detachAuthenticatedUser();
          set({
            error: null,
            isBootstrapped: true,
            status: ACCOUNT_ASYNC_STATUS.SUCCESS,
            user: createMockUser(email),
          });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          const session = await getAccountRepository(DATA_SOURCE.API).register({
            email: normalizeAccountEmail(email),
            password: password ?? "",
          });
          setAuthenticatedUser(set, session);
          void bootstrapAccountStores(session.user);
          return true;
        } catch (error) {
          setAuthError(set, error, "AUTH_REGISTER_FAILED", "The account could not be registered.");
          return false;
        }
      },
      resetPassword: async (input) => {
        if (getAccountDataSource() !== DATA_SOURCE.API) {
          clearAccountAccessToken();
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        }

        set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

        try {
          await getAccountRepository(DATA_SOURCE.API).resetPassword(input);
          set({ error: null, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
          return true;
        } catch (error) {
          setAuthError(set, error, "AUTH_PASSWORD_RESET_FAILED", "The password could not be reset.");
          return false;
        }
      },
      status: ACCOUNT_ASYNC_STATUS.IDLE,
      user: null,
    }),
    {
      merge: (persistedState, currentState) => mergePersistedState(persistedState, currentState),
      name: "entrenar-auth-preview",
      partialize: (state): PersistedAuthState => ({
        user: getAccountDataSource() === DATA_SOURCE.API ? null : state.user,
      }),
      skipHydration: true,
    },
  ),
);

async function bootstrapAuth(
  set: (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void,
  get: () => AuthState,
): Promise<boolean> {
  if (get().isBootstrapped) {
    return Boolean(get().user);
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  if (getAccountDataSource() !== DATA_SOURCE.API) {
    clearAccountAccessToken();
    set({ error: null, isBootstrapped: true, status: ACCOUNT_ASYNC_STATUS.SUCCESS });
    return Boolean(get().user);
  }

  bootstrapPromise = (async () => {
    set({ error: null, status: ACCOUNT_ASYNC_STATUS.LOADING });

    try {
      const user = await getAccountRepository(DATA_SOURCE.API).bootstrap();

      if (!user) {
        clearAccountAccessToken();
        clearAuthenticatedStores(get().user);
        set({
          error: null,
          isBootstrapped: true,
          status: ACCOUNT_ASYNC_STATUS.SUCCESS,
          user: null,
        });
        return false;
      }

      set({
        error: null,
        isBootstrapped: true,
        status: ACCOUNT_ASYNC_STATUS.SUCCESS,
        user,
      });
      reconcileCheckoutCart(user);
      await bootstrapAccountStores(user);
      return true;
    } catch (error) {
      setAuthError(set, error, "AUTH_BOOTSTRAP_FAILED", "The account session could not be restored.");
      clearAccountAccessToken();
      clearAuthenticatedStores(get().user);
      set({ isBootstrapped: true, user: null });
      return false;
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

function setAuthenticatedUser(
  set: (partial: Partial<AuthState>) => void,
  session: AuthSession,
): void {
  set({
    error: null,
    isBootstrapped: true,
    status: ACCOUNT_ASYNC_STATUS.SUCCESS,
    user: session.user,
  });
  reconcileCheckoutCart(session.user);
}

function reconcileCheckoutCart(user: AccountUser): void {
  if (getAccountDataSource() !== DATA_SOURCE.API || user.role !== ACCOUNT_ROLE.CUSTOMER) {
    return;
  }

  void useCartStore.getState().reconcileGuestCart(user.email).catch(() => undefined);
}

async function bootstrapAccountStores(user: AccountUser): Promise<void> {
  if (getAccountDataSource() !== DATA_SOURCE.API || user.role !== ACCOUNT_ROLE.CUSTOMER) {
    return;
  }

  await Promise.all([
    hydrateStore(useAccountProfileStore.persist.rehydrate, useAccountProfileStore.persist.hasHydrated()),
    hydrateStore(useWishlistStore.persist.rehydrate, useWishlistStore.persist.hasHydrated()),
  ]);
  useAccountProfileStore.getState().setActiveUser(user.email);
  useWishlistStore.getState().setActiveUser(user.email);
  await Promise.all([
    useAccountProfileStore.getState().bootstrap(user.email),
    useWishlistStore.getState().bootstrap(user.email),
  ]);
}

function hydrateStore(
  rehydrate: () => Promise<unknown> | unknown,
  isHydrated: boolean,
): Promise<unknown> {
  return isHydrated ? Promise.resolve() : Promise.resolve(rehydrate());
}

function clearAuthenticatedStores(user: AccountUser | null): void {
  useCartStore.getState().detachAuthenticatedUser();

  if (getAccountDataSource() !== DATA_SOURCE.API) {
    return;
  }

  if (user) {
    useAccountProfileStore.getState().clearForUser(user.email);
  }
  useAccountProfileStore.getState().setActiveUser(null);
  useWishlistStore.getState().setActiveUser(null);
}

function setAuthError(
  set: (partial: Partial<AuthState>) => void,
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): void {
  const operationError = toAccountApiError(error, fallbackCode, fallbackMessage);
  set({ error: operationError, status: ACCOUNT_ASYNC_STATUS.ERROR });
}

function mergePersistedState(persistedState: unknown, currentState: AuthState): AuthState {
  const persisted = isRecord(persistedState) ? persistedState : {};
  const persistedUser = readPersistedUser(persisted.user);
  const isApiSource = getAccountDataSource() === DATA_SOURCE.API;
  const hasCurrentApiSession = isApiSource && currentState.isBootstrapped;

  return {
    ...currentState,
    error: null,
    isBootstrapped: hasCurrentApiSession ? currentState.isBootstrapped : false,
    status: hasCurrentApiSession ? currentState.status : ACCOUNT_ASYNC_STATUS.IDLE,
    user: isApiSource ? (hasCurrentApiSession ? currentState.user : null) : persistedUser,
  };
}

function readPersistedUser(value: unknown): AccountUser | null {
  if (!isRecord(value) || typeof value.email !== "string") {
    return null;
  }

  return createMockUser(value.email, typeof value.name === "string" ? value.name : undefined);
}

function createMockUser(email: string, nameOverride?: string): AccountUser {
  const normalizedEmail = normalizeAccountEmail(email);
  const name = nameOverride?.trim() || deriveNameFromEmail(normalizedEmail);
  const [firstName = "Cliente", ...lastNameParts] = name.split(" ").filter(Boolean);

  return {
    birthDate: null,
    dni: null,
    email: normalizedEmail,
    firstName,
    gender: null,
    id: `mock-user-${normalizedEmail}`,
    lastName: lastNameParts.join(" "),
    name,
    phone: null,
    role: ACCOUNT_ROLE.CUSTOMER,
  };
}

function deriveNameFromEmail(email: string): string {
  if (email === "cliente@entrenar.com") {
    return "Cliente";
  }

  const [localPart] = email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ") || "Cliente";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
