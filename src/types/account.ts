export type AccountNavItem = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export interface MockAccountUser {
  email: string;
  name: string;
}

export const ACCOUNT_ROLE = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
} as const;

export type AccountRole = (typeof ACCOUNT_ROLE)[keyof typeof ACCOUNT_ROLE];

export interface AccountUser extends MockAccountUser {
  birthDate: string | null;
  dni: string | null;
  firstName: string | null;
  gender: string | null;
  id: string;
  lastName: string | null;
  phone: string | null;
  role: AccountRole;
}

export const ACCOUNT_SECTION = {
  AUTHENTICATION: "autenticacion",
  ADDRESSES: "direcciones",
  PAYMENT_METHODS: "metodos-de-pago",
  PROFILE: "perfil",
  ORDERS: "pedidos",
  WISHLIST: "lista-de-deseados",
} as const;

export type AccountSection = (typeof ACCOUNT_SECTION)[keyof typeof ACCOUNT_SECTION];

export interface AccountProfile {
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  gender: string;
  birthDate: string;
  phone: string;
}

export interface AccountAddress {
  id: string;
  label: string;
  recipient: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

export type AccountProfileUpdate = Omit<AccountProfile, "email">;
export type AccountAddressInput = Omit<AccountAddress, "id">;

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  user: AccountUser;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetInput {
  password: string;
  token: string;
}

export interface AccountOrderListOptions {
  limit?: number;
  page?: number;
}

export interface AccountApiIssue {
  code: string;
  field: string;
  message: string;
}

export interface AccountOperationError {
  code: string;
  issues?: readonly AccountApiIssue[];
  message: string;
  status?: number;
}

export const ACCOUNT_ASYNC_STATUS = {
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
} as const;

export type AccountAsyncStatus = (typeof ACCOUNT_ASYNC_STATUS)[keyof typeof ACCOUNT_ASYNC_STATUS];

export const ACCOUNT_ORDER_STATUS = {
  DELIVERED: "entregado",
  IN_TRANSIT: "en-camino",
  PREPARING: "preparacion",
} as const;

export type AccountOrderStatus = (typeof ACCOUNT_ORDER_STATUS)[keyof typeof ACCOUNT_ORDER_STATUS];

export interface AccountOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface AccountOrder {
  id: string;
  date: string;
  status: AccountOrderStatus;
  total: number;
  trackingCode: string;
  items: AccountOrderItem[];
}

export type WishlistProductId = string;
