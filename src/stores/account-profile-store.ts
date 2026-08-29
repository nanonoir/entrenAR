"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AccountApiError, toAccountApiError } from "@/lib/api/account/client";
import { getAccountRepository } from "@/lib/api/account/account.repository";
import { DATA_SOURCE, getAccountDataSource } from "@/lib/api/config";
import {
  isValidAccountAddress,
  isValidAccountProfile,
  normalizeAccountEmail,
} from "@/lib/account-validation";
import {
  ACCOUNT_ASYNC_STATUS,
  type AccountAddress,
  type AccountAddressInput,
  type AccountAsyncStatus,
  type AccountOperationError,
  type AccountProfile,
  type AccountProfileUpdate,
} from "@/types/account";

type AccountProfileState = {
  activeUserEmail: string | null;
  addressesByEmail: Record<string, AccountAddress[]>;
  addressesError: AccountOperationError | null;
  addressesStatus: AccountAsyncStatus;
  bootstrap: (email: string) => Promise<boolean>;
  clearForUser: (email: string) => void;
  ensureProfile: (email: string) => AccountProfile;
  error: AccountOperationError | null;
  legacyAddressesByEmail: Record<string, AccountAddress[]>;
  legacyProfilesByEmail: Record<string, AccountProfile>;
  load: (email: string) => Promise<boolean>;
  loadProfile: (email: string) => Promise<boolean>;
  profileError: AccountOperationError | null;
  profileStatus: AccountAsyncStatus;
  profilesByEmail: Record<string, AccountProfile>;
  reconciledByEmail: Record<string, boolean>;
  setActiveUser: (email: string | null) => void;
  addAddress: (email: string, address: AccountAddress) => Promise<boolean>;
  removeAddress: (email: string, addressId: string) => Promise<boolean>;
  updateAddress: (email: string, address: AccountAddress) => Promise<boolean>;
  updateProfile: (email: string, profile: AccountProfile) => Promise<boolean>;
};

type PersistedAccountProfileState = Pick<
  AccountProfileState,
  | "addressesByEmail"
  | "legacyAddressesByEmail"
  | "legacyProfilesByEmail"
  | "profilesByEmail"
  | "reconciledByEmail"
>;

const bootstrapPromises = new Map<string, Promise<boolean>>();

export const useAccountProfileStore = create<AccountProfileState>()(
  persist(
    (set, get) => ({
      activeUserEmail: null,
      addressesByEmail: {},
      addressesError: null,
      addressesStatus: ACCOUNT_ASYNC_STATUS.IDLE,
      bootstrap: (email) => bootstrapProfile(email, set, get),
      clearForUser: (email) => {
        const normalizedEmail = normalizeAccountEmail(email);

        set((state) => ({
          activeUserEmail: state.activeUserEmail === normalizedEmail ? null : state.activeUserEmail,
          addressesByEmail: withoutKey(state.addressesByEmail, normalizedEmail),
          addressesError: null,
          addressesStatus: ACCOUNT_ASYNC_STATUS.IDLE,
          error: null,
          profileError: null,
          profileStatus: ACCOUNT_ASYNC_STATUS.IDLE,
          profilesByEmail: withoutKey(state.profilesByEmail, normalizedEmail),
        }));
      },
      ensureProfile: (email) => {
        const normalizedEmail = normalizeAccountEmail(email);
        const existingProfile = get().profilesByEmail[normalizedEmail];

        if (existingProfile) {
          return existingProfile;
        }

        if (getAccountDataSource() === DATA_SOURCE.API) {
          return createInitialProfile(normalizedEmail);
        }

        const profile = createInitialProfile(normalizedEmail);
        set((state) => ({
          profilesByEmail: {
            ...state.profilesByEmail,
            [normalizedEmail]: profile,
          },
          addressesByEmail: {
            ...state.addressesByEmail,
            [normalizedEmail]: state.addressesByEmail[normalizedEmail] ?? [],
          },
        }));

        return profile;
      },
      error: null,
      legacyAddressesByEmail: {},
      legacyProfilesByEmail: {},
      load: (email) => bootstrapProfile(email, set, get, true),
      loadProfile: (email) => bootstrapProfile(email, set, get, true),
      profileError: null,
      profileStatus: ACCOUNT_ASYNC_STATUS.IDLE,
      profilesByEmail: {},
      reconciledByEmail: {},
      setActiveUser: (email) => {
        const normalizedEmail = email ? normalizeAccountEmail(email) : null;

        if (get().activeUserEmail === normalizedEmail) {
          return;
        }

        set((state) => ({
          activeUserEmail: normalizedEmail,
          addressesByEmail: withoutKeysForAccountChange(
            state.addressesByEmail,
            state.activeUserEmail,
            normalizedEmail,
          ),
          addressesError: null,
          addressesStatus: ACCOUNT_ASYNC_STATUS.IDLE,
          error: null,
          profileError: null,
          profileStatus: ACCOUNT_ASYNC_STATUS.IDLE,
          profilesByEmail: withoutKeysForAccountChange(
            state.profilesByEmail,
            state.activeUserEmail,
            normalizedEmail,
          ),
        }));
      },
      addAddress: async (email, address) => {
        const normalizedEmail = normalizeAccountEmail(email);

        activateProfileForAction(normalizedEmail, get);

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          const addresses = get().addressesByEmail[normalizedEmail] ?? [];
          if (addresses.length >= 6) {
            return false;
          }

          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: [...addresses, address],
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        }

        setAddressesLoading(set);

        try {
          const createdAddress = await getAccountRepository(DATA_SOURCE.API).createAddress(toAddressInput(address));

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: [...(state.addressesByEmail[normalizedEmail] ?? []), createdAddress],
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === normalizedEmail) {
            setAddressError(set, error);
          }
          return false;
        }
      },
      removeAddress: async (email, addressId) => {
        const normalizedEmail = normalizeAccountEmail(email);

        activateProfileForAction(normalizedEmail, get);

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).filter(
                (item) => item.id !== addressId,
              ),
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        }

        setAddressesLoading(set);

        try {
          await getAccountRepository(DATA_SOURCE.API).deleteAddress(addressId);

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).filter(
                (item) => item.id !== addressId,
              ),
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === normalizedEmail) {
            setAddressError(set, error);
          }
          return false;
        }
      },
      updateAddress: async (email, address) => {
        const normalizedEmail = normalizeAccountEmail(email);

        activateProfileForAction(normalizedEmail, get);

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).map((item) =>
                item.id === address.id ? address : item,
              ),
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        }

        setAddressesLoading(set);

        try {
          const updatedAddress = await getAccountRepository(DATA_SOURCE.API).updateAddress(
            address.id,
            toAddressInput(address),
          );

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          set((state) => ({
            addressesByEmail: {
              ...state.addressesByEmail,
              [normalizedEmail]: (state.addressesByEmail[normalizedEmail] ?? []).map((item) =>
                item.id === updatedAddress.id ? updatedAddress : item,
              ),
            },
            addressesError: null,
            addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            error: null,
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === normalizedEmail) {
            setAddressError(set, error);
          }
          return false;
        }
      },
      updateProfile: async (email, profile) => {
        const normalizedEmail = normalizeAccountEmail(email);

        activateProfileForAction(normalizedEmail, get);

        if (getAccountDataSource() !== DATA_SOURCE.API) {
          set((state) => ({
            error: null,
            profileError: null,
            profileStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            profilesByEmail: {
              ...state.profilesByEmail,
              [normalizedEmail]: { ...profile, email: normalizedEmail },
            },
          }));
          return true;
        }

        setProfileLoading(set);

        try {
          const updatedProfile = await getAccountRepository(DATA_SOURCE.API).updateProfile(
            withoutProfileEmail(profile),
          );

          assertProfileBelongsToUser(updatedProfile, normalizedEmail);

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          set((state) => ({
            error: null,
            legacyProfilesByEmail: withoutKey(state.legacyProfilesByEmail, normalizedEmail),
            profileError: null,
            profileStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
            profilesByEmail: {
              ...state.profilesByEmail,
              [normalizedEmail]: updatedProfile,
            },
          }));
          return true;
        } catch (error) {
          if (get().activeUserEmail === normalizedEmail) {
            setProfileError(set, error);
          }
          return false;
        }
      },
    }),
    {
      merge: (persistedState, currentState) => mergePersistedState(persistedState, currentState),
      name: "entrenar-account-profile-preview",
      partialize: (state): PersistedAccountProfileState => {
        if (getAccountDataSource() === DATA_SOURCE.API) {
          return {
            addressesByEmail: {},
            legacyAddressesByEmail: state.legacyAddressesByEmail,
            legacyProfilesByEmail: state.legacyProfilesByEmail,
            profilesByEmail: {},
            reconciledByEmail: state.reconciledByEmail,
          };
        }

        return {
          addressesByEmail: state.addressesByEmail,
          legacyAddressesByEmail: {},
          legacyProfilesByEmail: {},
          profilesByEmail: state.profilesByEmail,
          reconciledByEmail: {},
        };
      },
      skipHydration: true,
    },
  ),
);

async function bootstrapProfile(
  email: string,
  set: (partial: Partial<AccountProfileState> | ((state: AccountProfileState) => Partial<AccountProfileState>)) => void,
  get: () => AccountProfileState,
  forceReload = false,
): Promise<boolean> {
  const normalizedEmail = normalizeAccountEmail(email);

  if (getAccountDataSource() !== DATA_SOURCE.API) {
    get().ensureProfile(normalizedEmail);
    set({
      addressesError: null,
      addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
      error: null,
      profileError: null,
      profileStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
    });
    return true;
  }

  if (get().activeUserEmail !== normalizedEmail) {
    get().setActiveUser(normalizedEmail);
  }

  if (
    !forceReload &&
    get().activeUserEmail === normalizedEmail &&
    get().reconciledByEmail[normalizedEmail] &&
    get().profileStatus === ACCOUNT_ASYNC_STATUS.SUCCESS
  ) {
    return true;
  }

  const pending = bootstrapPromises.get(normalizedEmail);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    setProfileAndAddressLoading(set);

    try {
      const repository = getAccountRepository(DATA_SOURCE.API);
      let [profile, addresses] = await Promise.all([
        repository.getProfile(),
        repository.listAddresses(),
      ]);

      assertProfileBelongsToUser(profile, normalizedEmail);

      if (get().activeUserEmail !== normalizedEmail) {
        return false;
      }

      const stateBeforeReconciliation = get();
      const alreadyReconciled = stateBeforeReconciliation.reconciledByEmail[normalizedEmail] === true;

      if (!alreadyReconciled) {
        const legacyProfile = stateBeforeReconciliation.legacyProfilesByEmail[normalizedEmail];
        const legacyAddresses = stateBeforeReconciliation.legacyAddressesByEmail[normalizedEmail] ?? [];

        if (isEmptyProfile(profile) && legacyProfile && isValidAccountProfile(withoutProfileEmail(legacyProfile))) {
          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }

          try {
            profile = await repository.updateProfile(withoutProfileEmail(legacyProfile));
            assertProfileBelongsToUser(profile, normalizedEmail);
          } catch (error) {
            if (!isIgnorableLegacyError(error)) {
              throw error;
            }
          }

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }
        }

        if (addresses.length === 0 && legacyAddresses.length > 0) {
          for (const address of legacyAddresses.slice(0, 6)) {
            if (get().activeUserEmail !== normalizedEmail) {
              return false;
            }

            const addressInput = toAddressInput(address);
            if (!isValidAccountAddress(addressInput)) {
              removeLegacyAddress(set, normalizedEmail, address.id);
              continue;
            }

            try {
              await repository.createAddress(addressInput);

              if (get().activeUserEmail !== normalizedEmail) {
                return false;
              }

              removeLegacyAddress(set, normalizedEmail, address.id);
            } catch (error) {
              if (!isIgnorableLegacyError(error)) {
                throw error;
              }

              if (get().activeUserEmail !== normalizedEmail) {
                return false;
              }

              removeLegacyAddress(set, normalizedEmail, address.id);
            }
          }
          addresses = await repository.listAddresses();

          if (get().activeUserEmail !== normalizedEmail) {
            return false;
          }
        }

        if (get().activeUserEmail !== normalizedEmail) {
          return false;
        }

        set((state) => ({
          legacyAddressesByEmail: withoutKey(state.legacyAddressesByEmail, normalizedEmail),
          legacyProfilesByEmail: withoutKey(state.legacyProfilesByEmail, normalizedEmail),
          reconciledByEmail: {
            ...state.reconciledByEmail,
            [normalizedEmail]: true,
          },
        }));
      }

      if (get().activeUserEmail !== normalizedEmail) {
        return false;
      }

      set((state) => ({
        addressesByEmail: {
          ...state.addressesByEmail,
          [normalizedEmail]: addresses,
        },
        addressesError: null,
        addressesStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
        error: null,
        profileError: null,
        profileStatus: ACCOUNT_ASYNC_STATUS.SUCCESS,
        profilesByEmail: {
          ...state.profilesByEmail,
          [normalizedEmail]: profile,
        },
      }));
      return true;
    } catch (error) {
      const operationError = toAccountApiError(
        error,
        "ACCOUNT_BOOTSTRAP_FAILED",
        "The account data could not be loaded.",
      );
      if (get().activeUserEmail === normalizedEmail) {
        set({
          addressesError: operationError,
          addressesStatus: ACCOUNT_ASYNC_STATUS.ERROR,
          error: operationError,
          profileError: operationError,
          profileStatus: ACCOUNT_ASYNC_STATUS.ERROR,
        });
      }
      return false;
    } finally {
      bootstrapPromises.delete(normalizedEmail);
    }
  })();

  bootstrapPromises.set(normalizedEmail, promise);
  return promise;
}

function createInitialProfile(email: string): AccountProfile {
  const { firstName, lastName } = namePartsFromEmail(email);

  return {
    birthDate: "",
    dni: "",
    email,
    firstName,
    gender: "",
    lastName,
    phone: "",
  };
}

function activateProfileForAction(
  email: string,
  get: () => AccountProfileState,
): void {
  if (getAccountDataSource() === DATA_SOURCE.API && get().activeUserEmail !== email) {
    get().setActiveUser(email);
  }
}

function namePartsFromEmail(email: string): { firstName: string; lastName: string } {
  if (email === "cliente@entrenar.com") {
    return { firstName: "Cliente", lastName: "" };
  }

  const [localPart] = email.split("@");
  const parts = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`);

  return {
    firstName: parts[0] ?? "Cliente",
    lastName: parts.slice(1).join(" "),
  };
}

function withoutProfileEmail(profile: AccountProfile): AccountProfileUpdate {
  return {
    birthDate: profile.birthDate,
    dni: profile.dni,
    firstName: profile.firstName,
    gender: profile.gender,
    lastName: profile.lastName,
    phone: profile.phone,
  };
}

function toAddressInput(address: AccountAddress): AccountAddressInput {
  return {
    city: address.city,
    label: address.label,
    phone: address.phone,
    postalCode: address.postalCode,
    province: address.province,
    recipient: address.recipient,
    street: address.street,
  };
}

function isEmptyProfile(profile: AccountProfile): boolean {
  return [
    profile.firstName,
    profile.lastName,
    profile.dni,
    profile.gender,
    profile.birthDate,
    profile.phone,
  ].every((value) => value.trim() === "");
}

function assertProfileBelongsToUser(profile: AccountProfile, email: string): void {
  if (profile.email === email) {
    return;
  }

  throw new AccountApiError({
    code: "ACCOUNT_API_INVALID_RESPONSE",
    message: "The account API returned data for an unexpected account.",
    status: 502,
  });
}

function isIgnorableLegacyError(error: unknown): boolean {
  return error instanceof AccountApiError && [400, 404, 409].includes(error.status);
}

function setProfileAndAddressLoading(
  set: (partial: Partial<AccountProfileState>) => void,
): void {
  set({
    addressesError: null,
    addressesStatus: ACCOUNT_ASYNC_STATUS.LOADING,
    error: null,
    profileError: null,
    profileStatus: ACCOUNT_ASYNC_STATUS.LOADING,
  });
}

function setProfileLoading(set: (partial: Partial<AccountProfileState>) => void): void {
  set({
    error: null,
    profileError: null,
    profileStatus: ACCOUNT_ASYNC_STATUS.LOADING,
  });
}

function setAddressesLoading(set: (partial: Partial<AccountProfileState>) => void): void {
  set({
    addressesError: null,
    addressesStatus: ACCOUNT_ASYNC_STATUS.LOADING,
    error: null,
  });
}

function setProfileError(set: (partial: Partial<AccountProfileState>) => void, error: unknown): void {
  const operationError = toAccountApiError(error);
  set({
    error: operationError,
    profileError: operationError,
    profileStatus: ACCOUNT_ASYNC_STATUS.ERROR,
  });
}

function setAddressError(set: (partial: Partial<AccountProfileState>) => void, error: unknown): void {
  const operationError = toAccountApiError(error);
  set({
    addressesError: operationError,
    addressesStatus: ACCOUNT_ASYNC_STATUS.ERROR,
    error: operationError,
  });
}

function removeLegacyAddress(
  set: (partial: Partial<AccountProfileState> | ((state: AccountProfileState) => Partial<AccountProfileState>)) => void,
  email: string,
  addressId: string,
): void {
  set((state) => ({
    legacyAddressesByEmail: {
      ...state.legacyAddressesByEmail,
      [email]: (state.legacyAddressesByEmail[email] ?? []).filter((address) => address.id !== addressId),
    },
  }));
}

function mergePersistedState(
  persistedState: unknown,
  currentState: AccountProfileState,
): AccountProfileState {
  const persisted = isRecord(persistedState) ? persistedState : {};
  const persistedProfiles = readProfiles(persisted.profilesByEmail);
  const persistedAddresses = readAddresses(persisted.addressesByEmail);
  const persistedLegacyProfiles = readProfiles(persisted.legacyProfilesByEmail);
  const persistedLegacyAddresses = readAddresses(persisted.legacyAddressesByEmail);
  const reconciledByEmail = readBooleans(persisted.reconciledByEmail);

  if (getAccountDataSource() === DATA_SOURCE.API) {
    if (
      currentState.profileStatus === ACCOUNT_ASYNC_STATUS.SUCCESS &&
      (Object.keys(currentState.profilesByEmail).length > 0 || Object.keys(currentState.addressesByEmail).length > 0)
    ) {
      return currentState;
    }

    return {
      ...currentState,
      addressesByEmail: {},
      legacyAddressesByEmail: {
        ...persistedAddresses,
        ...persistedLegacyAddresses,
      },
      legacyProfilesByEmail: {
        ...persistedProfiles,
        ...persistedLegacyProfiles,
      },
      profileStatus: ACCOUNT_ASYNC_STATUS.IDLE,
      profilesByEmail: {},
      reconciledByEmail,
    };
  }

  return {
    ...currentState,
    addressesByEmail: {
      ...persistedLegacyAddresses,
      ...persistedAddresses,
    },
    addressesStatus: ACCOUNT_ASYNC_STATUS.IDLE,
    legacyAddressesByEmail: {},
    legacyProfilesByEmail: {},
    profileStatus: ACCOUNT_ASYNC_STATUS.IDLE,
    profilesByEmail: {
      ...persistedLegacyProfiles,
      ...persistedProfiles,
    },
    reconciledByEmail: {},
  };
}

function readProfiles(value: unknown): Record<string, AccountProfile> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, AccountProfile>>((profiles, [email, profile]) => {
    if (isAccountProfile(profile)) {
      profiles[email] = profile;
    }
    return profiles;
  }, {});
}

function readAddresses(value: unknown): Record<string, AccountAddress[]> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, AccountAddress[]>>((addresses, [email, valueForEmail]) => {
    if (Array.isArray(valueForEmail)) {
      const validAddresses = valueForEmail.filter(isAccountAddress);
      addresses[email] = validAddresses;
    }
    return addresses;
  }, {});
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

function isAccountProfile(value: unknown): value is AccountProfile {
  if (!isRecord(value)) {
    return false;
  }

  return ["email", "firstName", "lastName", "dni", "gender", "birthDate", "phone"].every(
    (field) => typeof value[field] === "string",
  );
}

function isAccountAddress(value: unknown): value is AccountAddress {
  if (!isRecord(value)) {
    return false;
  }

  return ["id", "label", "recipient", "street", "city", "province", "postalCode", "phone"].every(
    (field) => typeof value[field] === "string",
  );
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function withoutKeysForAccountChange<T>(
  record: Record<string, T>,
  previousEmail: string | null,
  nextEmail: string | null,
): Record<string, T> {
  const next = previousEmail ? withoutKey(record, previousEmail) : { ...record };
  return nextEmail ? withoutKey(next, nextEmail) : next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
