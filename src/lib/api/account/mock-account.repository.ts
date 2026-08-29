import { AccountApiError, clearAccountAccessToken } from "@/lib/api/account/client";
import type { AccountRepository } from "@/lib/api/account/account.repository";
import { getMockAccountOrders } from "@/lib/data/account";
import { getAllProducts } from "@/lib/data/products";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountOrder,
  AccountOrderListOptions,
  AccountProfile,
  AccountProfileUpdate,
  AccountUser,
  AuthCredentials,
  AuthSession,
  PasswordChangeInput,
  PasswordResetInput,
} from "@/types/account";
import type { ProductSummary } from "@/types/product";

const MOCK_ACCESS_TOKEN = "mock-account-access-token";

export class MockAccountRepository implements AccountRepository {
  private readonly addressesByEmail = new Map<string, AccountAddress[]>();
  private readonly profilesByEmail = new Map<string, AccountProfile>();
  private readonly wishlistByEmail = new Map<string, string[]>();
  private addressSequence = 0;
  private currentUser: AccountUser | null = null;

  async bootstrap(): Promise<AccountUser | null> {
    return this.currentUser;
  }

  async changePassword(input: PasswordChangeInput): Promise<void> {
    void input;
    this.requireUser();
    return undefined;
  }

  async forgotPassword(email: string): Promise<void> {
    void email;
    return undefined;
  }

  async getCurrentUser(): Promise<AccountUser> {
    return this.requireUser();
  }

  async login(input: AuthCredentials): Promise<AuthSession> {
    clearAccountAccessToken();
    return this.createSession(input.email);
  }

  async logout(): Promise<void> {
    clearAccountAccessToken();
    this.currentUser = null;
  }

  async refresh(): Promise<AuthSession> {
    clearAccountAccessToken();
    const user = this.requireUser();
    return { accessToken: MOCK_ACCESS_TOKEN, user };
  }

  async register(input: AuthCredentials): Promise<AuthSession> {
    clearAccountAccessToken();
    return this.createSession(input.email);
  }

  async resetPassword(input: PasswordResetInput): Promise<void> {
    void input;
    return undefined;
  }

  async addToWishlist(productId: string): Promise<void> {
    const user = this.requireUser();
    const product = getAllProducts().find((item) => item.id === productId);

    if (!product) {
      throw new AccountApiError({
        code: "PRODUCT_NOT_FOUND",
        message: "The requested public product was not found.",
        status: 404,
      });
    }

    const productIds = this.wishlistByEmail.get(user.email) ?? [];
    if (productIds.includes(product.id)) {
      throw new AccountApiError({
        code: "WISHLIST_ITEM_EXISTS",
        message: "The product is already in the wishlist.",
        status: 409,
      });
    }

    this.wishlistByEmail.set(user.email, [...productIds, product.id]);
  }

  async createAddress(input: AccountAddressInput): Promise<AccountAddress> {
    const user = this.requireUser();
    const addresses = this.addressesByEmail.get(user.email) ?? [];

    if (addresses.length >= 6) {
      throw new AccountApiError({
        code: "ADDRESS_LIMIT_REACHED",
        message: "An account cannot have more than six addresses.",
        status: 409,
      });
    }

    const address: AccountAddress = {
      ...input,
      id: `mock-address-${++this.addressSequence}`,
    };
    this.addressesByEmail.set(user.email, [...addresses, address]);
    return address;
  }

  async deleteAddress(id: string): Promise<void> {
    const user = this.requireUser();
    const addresses = this.addressesByEmail.get(user.email) ?? [];
    const nextAddresses = addresses.filter((address) => address.id !== id);

    if (nextAddresses.length === addresses.length) {
      throw this.addressNotFound();
    }

    this.addressesByEmail.set(user.email, nextAddresses);
  }

  async listAddresses(): Promise<AccountAddress[]> {
    const user = this.requireUser();
    return [...(this.addressesByEmail.get(user.email) ?? [])];
  }

  async listOrders(options: AccountOrderListOptions = {}): Promise<AccountOrder[]> {
    void options;
    this.requireUser();
    return getMockAccountOrders();
  }

  async listWishlist(): Promise<ProductSummary[]> {
    const user = this.requireUser();
    const productIds = this.wishlistByEmail.get(user.email) ?? [];
    const products = getAllProducts();

    return productIds.flatMap((productId) => {
      const product = products.find((item) => item.id === productId);
      return product ? [product] : [];
    });
  }

  async getProfile(): Promise<AccountProfile> {
    const user = this.requireUser();
    const existing = this.profilesByEmail.get(user.email);

    if (existing) {
      return { ...existing };
    }

    const profile = createInitialProfile(user);
    this.profilesByEmail.set(user.email, profile);
    return { ...profile };
  }

  async removeFromWishlist(productId: string): Promise<void> {
    const user = this.requireUser();
    const productIds = this.wishlistByEmail.get(user.email) ?? [];

    if (!productIds.includes(productId)) {
      throw new AccountApiError({
        code: "WISHLIST_ITEM_NOT_FOUND",
        message: "The product is not in the wishlist.",
        status: 404,
      });
    }

    this.wishlistByEmail.set(user.email, productIds.filter((item) => item !== productId));
  }

  async updateAddress(id: string, input: AccountAddressInput): Promise<AccountAddress> {
    const user = this.requireUser();
    const addresses = this.addressesByEmail.get(user.email) ?? [];
    const address = addresses.find((item) => item.id === id);

    if (!address) {
      throw this.addressNotFound();
    }

    const updated = { ...input, id };
    this.addressesByEmail.set(
      user.email,
      addresses.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  }

  async updateProfile(input: AccountProfileUpdate): Promise<AccountProfile> {
    const user = this.requireUser();
    const profile: AccountProfile = { ...input, email: user.email };
    this.profilesByEmail.set(user.email, profile);
    return { ...profile };
  }

  private createSession(email: string): AuthSession {
    const user = createMockUser(email);
    this.currentUser = user;
    return { accessToken: MOCK_ACCESS_TOKEN, user };
  }

  private requireUser(): AccountUser {
    if (this.currentUser) {
      return this.currentUser;
    }

    throw new AccountApiError({
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
      status: 401,
    });
  }

  private addressNotFound(): AccountApiError {
    return new AccountApiError({
      code: "NOT_FOUND",
      message: "The requested account address was not found.",
      status: 404,
    });
  }
}

function createMockUser(email: string): AccountUser {
  const normalizedEmail = email.trim().toLowerCase();
  const { firstName, lastName } = namePartsFromEmail(normalizedEmail);

  return {
    birthDate: null,
    dni: null,
    email: normalizedEmail,
    firstName,
    gender: null,
    id: `mock-user-${normalizedEmail}`,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" "),
    phone: null,
    role: "CUSTOMER",
  };
}

function createInitialProfile(user: AccountUser): AccountProfile {
  return {
    birthDate: user.birthDate ?? "",
    dni: user.dni ?? "",
    email: user.email,
    firstName: user.firstName ?? user.name,
    gender: user.gender ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
  };
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
