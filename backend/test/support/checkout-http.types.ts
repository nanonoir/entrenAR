export const HTTP_METHOD = {
  DELETE: "DELETE",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

export interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: HttpMethod;
  token?: string;
}

export interface FixtureUser {
  email: string;
  id: string;
  password: string;
}

export interface ProductFixture {
  productId: string;
  variantId: string;
}

export interface CartFixture {
  cartId: string;
  sessionToken: string;
}

export interface CheckoutFixtures {
  admin: FixtureUser;
  categoryId: string;
  customerCart: CartFixture;
  customerProduct: ProductFixture;
  foreign: FixtureUser;
  guestCart: CartFixture;
  guestOwner: FixtureUser;
  guestProduct: ProductFixture;
  hiddenProduct: ProductFixture;
  owner: FixtureUser;
  raceFirst: FixtureUser;
  raceFirstCart: CartFixture;
  raceProduct: ProductFixture;
  raceSecond: FixtureUser;
  raceSecondCart: CartFixture;
  replayCart: CartFixture;
  replayOwner: FixtureUser;
  replayProduct: ProductFixture;
  staleCart: CartFixture;
  staleOwner: FixtureUser;
  staleProduct: ProductFixture;
  suffix: string;
  validationCart: CartFixture;
  validationOwner: FixtureUser;
  validationProduct: ProductFixture;
}

export interface SessionFixture {
  accessToken: string;
}

export interface CheckoutQuoteResponse {
  coupon?: unknown;
  currency: string;
  discount: number;
  expiresAt?: string;
  items: CheckoutQuoteItemResponse[];
  ok: true;
  paymentMethods: unknown[];
  pickupPoints: unknown[];
  quoteId: string;
  sessionToken?: string;
  shipping: number;
  shippingOptions: unknown[];
  subtotal: number;
  total: number;
  warnings: unknown[];
}

export interface CheckoutQuoteItemResponse {
  lineSubtotal: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface CheckoutCompleteResponse {
  currency?: string;
  number: string;
  ok: true;
  order?: unknown;
  orderId: string;
  status?: string;
  total?: number;
}

export interface AccountOrderResponse {
  date: string;
  id: string;
  items: AccountOrderItemResponse[];
  status: string;
  total: number;
  trackingCode: string;
}

export interface AccountOrderItemResponse {
  id: string;
  name: string;
  price: number;
  quantity: number;
}
