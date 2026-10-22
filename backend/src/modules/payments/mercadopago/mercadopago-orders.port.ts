export const MERCADOPAGO_ORDERS_PORT = Symbol("MERCADOPAGO_ORDERS_PORT");

export const MERCADOPAGO_ERROR_CATEGORY = {
  AUTH: "auth",
  CONFLICT: "conflict",
  RATE_LIMIT: "rate_limit",
  TRANSIENT: "transient",
  UNKNOWN: "unknown",
  VALIDATION: "validation",
} as const;

export type MercadoPagoErrorCategory = (typeof MERCADOPAGO_ERROR_CATEGORY)[keyof typeof MERCADOPAGO_ERROR_CATEGORY];

export interface MercadoPagoOrdersErrorOptions {
  category: MercadoPagoErrorCategory;
  httpStatus?: number;
  /** True when the provider may have processed the request even though no usable response was received. */
  outcomeUncertain?: boolean;
  providerCode?: string;
  retryAfterSeconds?: number;
}

/** Sanitized provider failure. Never carries request bodies, tokens or raw provider payloads. */
export class MercadoPagoOrdersError extends Error {
  readonly category: MercadoPagoErrorCategory;
  readonly httpStatus?: number;
  readonly outcomeUncertain: boolean;
  readonly providerCode?: string;
  readonly retryAfterSeconds?: number;

  constructor(message: string, options: MercadoPagoOrdersErrorOptions) {
    super(message);
    this.name = "MercadoPagoOrdersError";
    this.category = options.category;
    this.httpStatus = options.httpStatus;
    this.outcomeUncertain = options.outcomeUncertain ?? false;
    this.providerCode = options.providerCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface MercadoPagoPayer {
  email: string;
  firstName?: string;
  lastName?: string;
  identification?: { number: string; type: string };
}

export interface MercadoPagoOrderItem {
  categoryId?: string;
  description?: string;
  externalCode?: string;
  quantity: number;
  title: string;
  /** Decimal string with two places. */
  unitPrice: string;
}

export interface CreateMercadoPagoOrderRequest {
  /** Mercado Pago device/session id for fraud prevention; sent as X-meli-session-id. */
  deviceId?: string;
  externalReference: string;
  items?: readonly MercadoPagoOrderItem[];
  payer: MercadoPagoPayer;
  payment: {
    /** Decimal string with two places; must equal `totalAmount`. */
    amount: string;
    installments: number;
    paymentMethodId: string;
    paymentMethodType: string;
    statementDescriptor?: string;
    /** Card token. Lives in memory only; never logged or persisted. */
    token: string;
  };
  /** Decimal string with two places. */
  totalAmount: string;
}

export interface MercadoPagoTransaction {
  /** Decimal strings with two places. */
  amount: string;
  id: string;
  paidAmount?: string;
  paymentMethod?: { id?: string; installments?: number; type?: string };
  referenceId?: string;
  refundedAmount?: string;
  status: string;
  statusDetail: string;
  /** 3DS challenge URL (`payment_method.transaction_security.url`). Never persisted; callers must validate it before exposing it. */
  transactionSecurityUrl?: string;
}

export interface MercadoPagoChargeback {
  caseId?: string;
  id: string;
  status: string;
  transactionId?: string;
}

export interface MercadoPagoOrder {
  applicationId?: string;
  chargebacks: MercadoPagoChargeback[];
  createdAt?: string;
  currency?: string;
  externalReference: string;
  id: string;
  lastUpdatedAt?: string;
  /** Sum of completed refunds, decimal string with two places. */
  refundedAmount: string;
  status: string;
  statusDetail: string;
  totalAmount: string;
  totalPaidAmount?: string;
  transactions: MercadoPagoTransaction[];
  userId?: string;
}

export interface SearchMercadoPagoOrdersQuery {
  externalReference: string;
  /** Bounded to 1..MAX_SEARCH_LIMIT; defaults to MAX_SEARCH_LIMIT. */
  limit?: number;
}

export const MERCADOPAGO_MAX_SEARCH_LIMIT = 20;

export interface MercadoPagoOrdersPort {
  /** `idempotencyKey` is sent as X-Idempotency-Key; callers must reuse it only for the same logical request. */
  createOrder(request: CreateMercadoPagoOrderRequest, idempotencyKey: string): Promise<MercadoPagoOrder>;
  getOrder(orderId: string): Promise<MercadoPagoOrder>;
  searchOrders(query: SearchMercadoPagoOrdersQuery): Promise<MercadoPagoOrder[]>;
}
