import {
  AccountApiError,
  FetchAccountApiClient,
  getAccountAccessToken,
  clearAccountAccessToken,
  setAccountAccessToken,
  type AccountApiClient,
} from "@/lib/api/account/client";
import type { AccountRepository } from "@/lib/api/account/account.repository";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountOrder,
  AccountOrderListOptions,
  AccountOrderStatus,
  AccountProfile,
  AccountProfileUpdate,
  AccountRole,
  AccountUser,
  AuthCredentials,
  AuthSession,
  PasswordChangeInput,
  PasswordResetInput,
} from "@/types/account";
import type { ProductSummary, ProductImageTone } from "@/types/product";

interface AuthUserDto {
  birthDate?: string | null;
  dni?: string | null;
  email: string;
  firstName?: string | null;
  gender?: string | null;
  id: string;
  lastName?: string | null;
  phone?: string | null;
  role: string;
}

interface AuthSessionDto {
  accessToken: string;
  user: AuthUserDto;
}

interface AccountProfileDto {
  birthDate: string | null;
  dni: string | null;
  email: string;
  firstName: string | null;
  gender: string | null;
  lastName: string | null;
  phone: string | null;
}

interface AccountAddressDto extends AccountAddressInput {
  id: string;
}

interface AccountOrderItemDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface AccountOrderDto {
  date: string;
  id: string;
  items: AccountOrderItemDto[];
  status: string;
  total: number;
  trackingCode: string;
}

interface WishlistProductDto {
  brand: string;
  categoryName: string;
  categorySlug: string;
  compareAtPrice?: number;
  id: string;
  imageTone: string;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  name: string;
  price: number;
  rating: number;
  reviews: number;
  shortDescription: string;
  slug: string;
  stock: number;
  subcategorySlugs?: string[];
  tags: string[];
}

export class AccountApiRepository implements AccountRepository {
  constructor(private readonly client: AccountApiClient = new FetchAccountApiClient()) {}

  async bootstrap(): Promise<AccountUser | null> {
    try {
      if (!getAccountAccessToken()) {
        await this.refresh();
      }

      return await this.getCurrentUser();
    } catch (error) {
      clearAccountAccessToken();

      if (isUnauthorized(error)) {
        return null;
      }

      throw error;
    }
  }

  async changePassword(input: PasswordChangeInput): Promise<void> {
    const response = await this.client.post<unknown>("/auth/change-password", input, { retryOnUnauthorized: true });
    assertSuccess(response);
  }

  async forgotPassword(email: string): Promise<void> {
    const response = await this.client.post<unknown>(
      "/auth/forgot-password",
      { email: email.trim().toLowerCase() },
      { includeAuthorization: false, retryOnUnauthorized: false },
    );
    assertSuccess(response);
  }

  async getCurrentUser(): Promise<AccountUser> {
    const response = await this.client.get<unknown>("/auth/me");
    return this.mapResponse(response, mapAccountUser);
  }

  async login(input: AuthCredentials): Promise<AuthSession> {
    const response = await this.client.post<unknown>(
      "/auth/login",
      normalizeCredentials(input),
      { includeAuthorization: false, retryOnUnauthorized: false },
    );
    return this.setSession(response);
  }

  async logout(): Promise<void> {
    try {
      const response = await this.client.post<unknown>("/auth/logout", undefined, {
        includeAuthorization: false,
        retryOnUnauthorized: false,
      });

      if (response !== undefined) {
        assertSuccess(response);
      }
    } finally {
      clearAccountAccessToken();
    }
  }

  async refresh(): Promise<AuthSession> {
    try {
      const response = await this.client.post<unknown>("/auth/refresh", undefined, {
        includeAuthorization: false,
        retryOnUnauthorized: false,
      });
      return this.setSession(response);
    } catch (error) {
      clearAccountAccessToken();
      throw error;
    }
  }

  async register(input: AuthCredentials): Promise<AuthSession> {
    const response = await this.client.post<unknown>(
      "/auth/register",
      normalizeCredentials(input),
      { includeAuthorization: false, retryOnUnauthorized: false },
    );
    return this.setSession(response);
  }

  async resetPassword(input: PasswordResetInput): Promise<void> {
    const response = await this.client.post<unknown>("/auth/reset-password", input, {
      includeAuthorization: false,
      retryOnUnauthorized: false,
    });
    assertSuccess(response);
  }

  async addToWishlist(productId: string): Promise<void> {
    const response = await this.client.post<unknown>(`/wishlist/${encodeURIComponent(productId)}`);
    assertSuccess(response);
  }

  async createAddress(input: AccountAddressInput): Promise<AccountAddress> {
    const response = await this.client.post<unknown>("/account/addresses", withoutAddressId(input));
    return this.mapResponse(response, mapAccountAddress);
  }

  async deleteAddress(id: string): Promise<void> {
    const response = await this.client.delete<unknown>(`/account/addresses/${encodeURIComponent(id)}`);
    assertSuccess(response);
  }

  async listAddresses(): Promise<AccountAddress[]> {
    const response = await this.client.get<unknown>("/account/addresses");
    return this.mapResponse(response, mapAccountAddresses);
  }

  async listOrders(options: AccountOrderListOptions = {}): Promise<AccountOrder[]> {
    const query = new URLSearchParams();
    query.set("page", String(options.page ?? 1));
    query.set("limit", String(options.limit ?? 20));
    const response = await this.client.get<unknown>(`/account/orders?${query.toString()}`);
    return this.mapResponse(response, mapAccountOrders);
  }

  async listWishlist(): Promise<ProductSummary[]> {
    const response = await this.client.get<unknown>("/wishlist");
    return this.mapResponse(response, mapWishlistProducts);
  }

  async getProfile(): Promise<AccountProfile> {
    const response = await this.client.get<unknown>("/account/profile");
    return this.mapResponse(response, mapAccountProfile);
  }

  async removeFromWishlist(productId: string): Promise<void> {
    const response = await this.client.delete<unknown>(`/wishlist/${encodeURIComponent(productId)}`);
    assertSuccess(response);
  }

  async updateAddress(id: string, input: AccountAddressInput): Promise<AccountAddress> {
    const response = await this.client.put<unknown>(
      `/account/addresses/${encodeURIComponent(id)}`,
      withoutAddressId(input),
    );
    return this.mapResponse(response, mapAccountAddress);
  }

  async updateProfile(input: AccountProfileUpdate): Promise<AccountProfile> {
    const response = await this.client.put<unknown>("/account/profile", withoutProfileEmail(input));
    return this.mapResponse(response, mapAccountProfile);
  }

  private mapResponse<T>(response: unknown, mapper: (value: unknown) => T): T {
    try {
      return mapper(response);
    } catch (error) {
      if (error instanceof AccountApiError) {
        throw error;
      }

      throw invalidResponse();
    }
  }

  private setSession(response: unknown): AuthSession {
    const session = this.mapResponse(response, mapAuthSession);
    setAccountAccessToken(session.accessToken);
    return session;
  }
}

function normalizeCredentials(input: AuthCredentials): AuthCredentials {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
}

function withoutAddressId(input: AccountAddressInput): AccountAddressInput {
  return {
    city: input.city,
    label: input.label,
    phone: input.phone,
    postalCode: input.postalCode,
    province: input.province,
    recipient: input.recipient,
    street: input.street,
  };
}

function withoutProfileEmail(input: AccountProfileUpdate): AccountProfileUpdate {
  return {
    birthDate: input.birthDate,
    dni: input.dni,
    firstName: input.firstName,
    gender: input.gender,
    lastName: input.lastName,
    phone: input.phone,
  };
}

function mapAuthSession(value: unknown): AuthSession {
  const record = asRecord(value);

  return {
    accessToken: requiredString(record.accessToken, "accessToken"),
    user: mapAccountUser(record.user),
  };
}

function mapAccountUser(value: unknown): AccountUser {
  const record = asRecord(value);
  const firstName = nullableString(record.firstName, "firstName");
  const lastName = nullableString(record.lastName, "lastName");

  return {
    birthDate: nullableString(record.birthDate, "birthDate"),
    dni: nullableString(record.dni, "dni"),
    email: requiredString(record.email, "email").toLowerCase(),
    firstName,
    gender: nullableString(record.gender, "gender"),
    id: requiredString(record.id, "id"),
    lastName,
    name: displayName(firstName, lastName, requiredString(record.email, "email")),
    phone: nullableString(record.phone, "phone"),
    role: accountRole(record.role),
  };
}

function mapAccountProfile(value: unknown): AccountProfile {
  const record = asRecord(value);

  return {
    birthDate: nullableString(record.birthDate, "birthDate") ?? "",
    dni: nullableString(record.dni, "dni") ?? "",
    email: requiredString(record.email, "email").toLowerCase(),
    firstName: nullableString(record.firstName, "firstName") ?? "",
    gender: nullableString(record.gender, "gender") ?? "",
    lastName: nullableString(record.lastName, "lastName") ?? "",
    phone: nullableString(record.phone, "phone") ?? "",
  };
}

function mapAccountAddresses(value: unknown): AccountAddress[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }

  return value.map(mapAccountAddress);
}

function mapAccountAddress(value: unknown): AccountAddress {
  const record = asRecord(value);

  return {
    city: requiredString(record.city, "city"),
    id: requiredString(record.id, "id"),
    label: requiredString(record.label, "label"),
    phone: requiredString(record.phone, "phone"),
    postalCode: requiredString(record.postalCode, "postalCode"),
    province: requiredString(record.province, "province"),
    recipient: requiredString(record.recipient, "recipient"),
    street: requiredString(record.street, "street"),
  };
}

function mapAccountOrders(value: unknown): AccountOrder[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }

  return value.map(mapAccountOrder);
}

function mapAccountOrder(value: unknown): AccountOrder {
  const record = asRecord(value);
  const items = record.items;

  if (!Array.isArray(items)) {
    throw invalidResponse();
  }

  return {
    date: requiredString(record.date, "date"),
    id: requiredString(record.id, "id"),
    items: items.map(mapAccountOrderItem),
    status: accountOrderStatus(record.status),
    total: finiteNumber(record.total, "total"),
    trackingCode: requiredString(record.trackingCode, "trackingCode"),
  };
}

function mapAccountOrderItem(value: unknown) {
  const record = asRecord(value);

  return {
    id: requiredString(record.id, "id"),
    name: requiredString(record.name, "name"),
    price: finiteNumber(record.price, "price"),
    quantity: positiveInteger(record.quantity, "quantity"),
  };
}

function mapWishlistProducts(value: unknown): ProductSummary[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }

  return value.map(mapWishlistProduct);
}

function mapWishlistProduct(value: unknown): ProductSummary {
  const record = asRecord(value);
  const compareAtPrice = optionalFiniteNumber(record.compareAtPrice, "compareAtPrice");

  return {
    brand: requiredString(record.brand, "brand"),
    categoryName: requiredString(record.categoryName, "categoryName"),
    categorySlug: requiredString(record.categorySlug, "categorySlug"),
    ...(compareAtPrice === undefined ? {} : { compareAtPrice }),
    id: requiredString(record.id, "id"),
    imageTone: imageTone(record.imageTone),
    ...(optionalBoolean(record.isBestSeller, "isBestSeller") ? { isBestSeller: true } : {}),
    ...(optionalBoolean(record.isFeatured, "isFeatured") ? { isFeatured: true } : {}),
    name: requiredString(record.name, "name"),
    price: finiteNumber(record.price, "price"),
    rating: finiteNumber(record.rating, "rating"),
    reviews: finiteNumber(record.reviews, "reviews"),
    shortDescription: requiredString(record.shortDescription, "shortDescription"),
    slug: requiredString(record.slug, "slug"),
    stock: finiteNumber(record.stock, "stock"),
    subcategorySlugs: stringArray(record.subcategorySlugs, "subcategorySlugs"),
    tags: stringArray(record.tags, "tags"),
  };
}

function assertSuccess(value: unknown): void {
  const record = asRecord(value);

  if (record.ok !== true) {
    throw invalidResponse();
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse();
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return value.trim();
}

function finiteNumber(value: unknown, field: string): number {
  const normalized = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(normalized)) {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return normalized;
}

function optionalFiniteNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return finiteNumber(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const normalized = finiteNumber(value, field);

  if (!Number.isInteger(normalized) || normalized < 1) {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return normalized;
}

function optionalBoolean(value: unknown, field: string): boolean {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalidResponse(`The account API returned an invalid ${field}.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function accountRole(value: unknown): AccountRole {
  if (value === "CUSTOMER" || value === "ADMIN") {
    return value;
  }

  throw invalidResponse("The account API returned an invalid role.");
}

function accountOrderStatus(value: unknown): AccountOrderStatus {
  if (value === "preparacion" || value === "en-camino" || value === "entregado") {
    return value;
  }

  throw invalidResponse("The account API returned an invalid order status.");
}

function imageTone(value: unknown): ProductImageTone {
  if (value === "green" || value === "black" || value === "red" || value === "amber" || value === "blue") {
    return value;
  }

  return "green";
}

function displayName(firstName: string | null, lastName: string | null, email: string): string {
  const fullName = [firstName, lastName].filter((value): value is string => Boolean(value?.trim())).join(" ");
  if (fullName) {
    return fullName;
  }

  const [localPart] = email.split("@");
  return localPart
    ?.split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ") || "Cliente";
}

function invalidResponse(message = "The account API returned an invalid response."): AccountApiError {
  return new AccountApiError({
    code: "ACCOUNT_API_INVALID_RESPONSE",
    message,
    status: 502,
  });
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof AccountApiError && error.status === 401;
}

export type {
  AccountAddressDto,
  AccountOrderDto,
  AccountOrderItemDto,
  AccountProfileDto,
  AuthSessionDto,
  AuthUserDto,
  WishlistProductDto,
};
