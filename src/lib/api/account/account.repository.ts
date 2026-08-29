import { DATA_SOURCE, getAccountDataSource, type DataSource } from "@/lib/api/config";
import { AccountApiRepository } from "@/lib/api/account/account-api.repository";
import { MockAccountRepository } from "@/lib/api/account/mock-account.repository";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountOrder,
  AccountOrderListOptions,
  AccountProfile,
  AccountProfileUpdate,
  AuthCredentials,
  AuthSession,
  PasswordChangeInput,
  PasswordResetInput,
} from "@/types/account";
import type { AuthRepository as AccountAuthRepository } from "@/lib/api/account/auth.repository";
import type { ProductSummary } from "@/types/product";

export interface AccountRepository extends AccountAuthRepository {
  addToWishlist(productId: string): Promise<void>;
  createAddress(input: AccountAddressInput): Promise<AccountAddress>;
  deleteAddress(id: string): Promise<void>;
  listAddresses(): Promise<AccountAddress[]>;
  listOrders(options?: AccountOrderListOptions): Promise<AccountOrder[]>;
  listWishlist(): Promise<ProductSummary[]>;
  getProfile(): Promise<AccountProfile>;
  removeFromWishlist(productId: string): Promise<void>;
  updateAddress(id: string, input: AccountAddressInput): Promise<AccountAddress>;
  updateProfile(input: AccountProfileUpdate): Promise<AccountProfile>;
}

export type AccountAuthContract = Pick<
  AccountRepository,
  | "bootstrap"
  | "changePassword"
  | "forgotPassword"
  | "getCurrentUser"
  | "login"
  | "logout"
  | "refresh"
  | "register"
  | "resetPassword"
>;

const mockAccountRepository = new MockAccountRepository();
const apiAccountRepository = new AccountApiRepository();

export function getAccountRepository(source = getAccountDataSource()): AccountRepository {
  return source === DATA_SOURCE.API ? apiAccountRepository : mockAccountRepository;
}

export function getAccountAuthRepository(source?: DataSource): AccountAuthContract {
  return getAccountRepository(source);
}

export type {
  AccountAddress,
  AccountAddressInput,
  AccountOrder,
  AccountOrderListOptions,
  AccountProfile,
  AccountProfileUpdate,
  AuthCredentials,
  AuthSession,
  PasswordChangeInput,
  PasswordResetInput,
};
