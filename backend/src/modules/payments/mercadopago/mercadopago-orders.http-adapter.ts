import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AppConfig, MercadoPagoConfig } from "../../../config/app.config";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_MAX_SEARCH_LIMIT,
  MercadoPagoOrdersError,
  type CreateMercadoPagoOrderRequest,
  type MercadoPagoErrorCategory,
  type MercadoPagoOrder,
  type MercadoPagoOrdersPort,
  type SearchMercadoPagoOrdersQuery,
} from "./mercadopago-orders.port";
import {
  mercadoPagoErrorResponseSchema,
  mercadoPagoSearchResponseSchema,
  toCents,
  toMercadoPagoOrder,
} from "./mercadopago-orders.schemas";

export const MERCADOPAGO_FETCH = Symbol("MERCADOPAGO_FETCH");

/** Fixed origin: test and production share it and differ only by credentials. */
export const MERCADOPAGO_API_ORIGIN = "https://api.mercadopago.com";
export const MERCADOPAGO_REQUEST_TIMEOUT_MS = 10_000;

type FetchFunction = typeof fetch;

@Injectable()
export class MercadoPagoHttpOrdersAdapter implements MercadoPagoOrdersPort {
  private readonly fetchFunction: FetchFunction;

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    @Optional() @Inject(MERCADOPAGO_FETCH) fetchFunction?: FetchFunction,
  ) {
    this.fetchFunction = fetchFunction ?? ((input, init) => fetch(input, init));
  }

  async createOrder(request: CreateMercadoPagoOrderRequest, idempotencyKey: string): Promise<MercadoPagoOrder> {
    const body = await this.send("POST", "/v1/orders", {
      body: buildCreateBody(request),
      ...(request.deviceId ? { deviceId: request.deviceId } : {}),
      idempotencyKey,
      uncertainOnFailure: true,
    });
    return parseOrder(body, true);
  }

  async getOrder(orderId: string): Promise<MercadoPagoOrder> {
    const body = await this.send("GET", `/v1/orders/${encodeURIComponent(orderId)}`, {});
    return parseOrder(body, false);
  }

  async searchOrders(query: SearchMercadoPagoOrdersQuery): Promise<MercadoPagoOrder[]> {
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? MERCADOPAGO_MAX_SEARCH_LIMIT), 1), MERCADOPAGO_MAX_SEARCH_LIMIT);
    const { beginDate, endDate } = searchWindow(query.submittedAt, new Date());
    const search = new URLSearchParams({
      begin_date: beginDate,
      end_date: endDate,
      external_reference: query.externalReference,
      page_size: String(limit),
      type: "online",
    });
    const body = await this.send("GET", `/v1/orders?${search.toString()}`, {});
    const items = mercadoPagoSearchResponseSchema.safeParse(body);

    if (!items.success) {
      throw new MercadoPagoOrdersError("Mercado Pago search response has an unexpected shape.", { category: MERCADOPAGO_ERROR_CATEGORY.UNKNOWN });
    }

    return items.data.slice(0, limit).map((item) => parseOrder(item, false));
  }

  private async send(
    method: "GET" | "POST",
    path: string,
    options: { body?: unknown; deviceId?: string; idempotencyKey?: string; uncertainOnFailure?: boolean },
  ): Promise<unknown> {
    const config = this.requireConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MERCADOPAGO_REQUEST_TIMEOUT_MS);
    const uncertain = options.uncertainOnFailure ?? false;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    };

    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey !== undefined) headers["X-Idempotency-Key"] = options.idempotencyKey;
    if (options.deviceId !== undefined) headers["X-meli-session-id"] = options.deviceId;

    let response: Response;
    try {
      response = await this.fetchFunction(`${MERCADOPAGO_API_ORIGIN}${path}`, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method,
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new MercadoPagoOrdersError(
        timedOut ? "Mercado Pago request timed out." : "Mercado Pago request could not be completed.",
        { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT, outcomeUncertain: uncertain, providerCode: timedOut ? "timeout" : "network_error" },
      );
    } finally {
      clearTimeout(timer);
    }

    const payload = await readJson(response);

    if (!response.ok) {
      // Failed card payments answer 4xx with the full order (status "failed") in `data`: that is an outcome, not an HTTP error.
      const failedOrder = extractOrderBody(payload);
      if (failedOrder !== undefined) return failedOrder;
      throw toProviderError(response, payload, uncertain);
    }

    return payload;
  }

  private requireConfig(): MercadoPagoConfig {
    const config = this.configService.get("mercadoPago", { infer: true });

    if (!config) {
      throw new MercadoPagoOrdersError("Mercado Pago integration is not configured.", {
        category: MERCADOPAGO_ERROR_CATEGORY.UNKNOWN,
        providerCode: "integration_not_configured",
      });
    }

    return config;
  }
}

const SEARCH_LOOKBACK_MS = 60 * 60 * 1_000;
const SEARCH_LOOKAHEAD_MS = 24 * 60 * 60 * 1_000;
const SEARCH_NOW_MARGIN_MS = 5 * 60 * 1_000;

/** Creation-date window (RFC 3339) bounded around the attempt: submittedAt - 1h to min(submittedAt + 24h, now + 5m). */
export function searchWindow(submittedAt: Date, now: Date): { beginDate: string; endDate: string } {
  const begin = submittedAt.getTime() - SEARCH_LOOKBACK_MS;
  const end = Math.max(Math.min(submittedAt.getTime() + SEARCH_LOOKAHEAD_MS, now.getTime() + SEARCH_NOW_MARGIN_MS), begin + 1_000);
  return { beginDate: new Date(begin).toISOString(), endDate: new Date(end).toISOString() };
}

/** Items are sent only when they add up to the total exactly (cents); otherwise the provider rejects the order. */
function itemsMatchTotal(request: CreateMercadoPagoOrderRequest): boolean {
  if (!request.items || request.items.length === 0) return false;
  const sum = request.items.reduce((total, item) => total + item.quantity * toCents(item.unitPrice), 0);
  return sum === toCents(request.totalAmount);
}

function buildCreateBody(request: CreateMercadoPagoOrderRequest): Record<string, unknown> {
  const { payer, payment } = request;

  return {
    capture_mode: "automatic",
    config: { online: { transaction_security: { liability_shift: "required", validation: "on_fraud_risk" } } },
    external_reference: request.externalReference,
    ...(request.items && itemsMatchTotal(request)
      ? {
          items: request.items.map((item) => ({
            ...(item.categoryId ? { category_id: item.categoryId } : {}),
            ...(item.description ? { description: item.description } : {}),
            ...(item.externalCode ? { external_code: item.externalCode } : {}),
            quantity: item.quantity,
            title: item.title,
            unit_price: item.unitPrice,
          })),
        }
      : {}),
    payer: {
      email: payer.email,
      ...(payer.firstName ? { first_name: payer.firstName } : {}),
      ...(payer.identification ? { identification: payer.identification } : {}),
      ...(payer.lastName ? { last_name: payer.lastName } : {}),
    },
    processing_mode: "automatic",
    total_amount: request.totalAmount,
    transactions: {
      payments: [
        {
          amount: payment.amount,
          payment_method: {
            id: payment.paymentMethodId,
            installments: payment.installments,
            ...(payment.statementDescriptor ? { statement_descriptor: payment.statementDescriptor } : {}),
            token: payment.token,
            type: payment.paymentMethodType,
          },
        },
      ],
    },
    type: "online",
  };
}

function parseOrder(payload: unknown, uncertain: boolean): MercadoPagoOrder {
  try {
    return toMercadoPagoOrder(payload);
  } catch {
    throw new MercadoPagoOrdersError("Mercado Pago order response has an unexpected shape.", {
      category: MERCADOPAGO_ERROR_CATEGORY.UNKNOWN,
      outcomeUncertain: uncertain,
      providerCode: "invalid_response",
    });
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toProviderError(response: Response, payload: unknown, uncertain: boolean): MercadoPagoOrdersError {
  const status = response.status;
  const parsed = mercadoPagoErrorResponseSchema.safeParse(payload);
  const providerCode = sanitizeCode(parsed.success ? parsed.data.errors?.[0]?.code ?? parsed.data.code ?? parsed.data.error : undefined);
  const providerDetail = parsed.success ? describeDetails(parsed.data.errors) : undefined;
  const category = categorize(status);
  const retryAfter = Number(response.headers.get("retry-after"));

  return new MercadoPagoOrdersError(`Mercado Pago responded with HTTP ${status}.`, {
    category,
    httpStatus: status,
    outcomeUncertain: uncertain && (category === MERCADOPAGO_ERROR_CATEGORY.TRANSIENT || category === MERCADOPAGO_ERROR_CATEGORY.UNKNOWN),
    providerCode,
    ...(providerDetail ? { providerDetail } : {}),
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  });
}

function categorize(status: number): MercadoPagoErrorCategory {
  if (status === 400 || status === 422) return MERCADOPAGO_ERROR_CATEGORY.VALIDATION;
  if (status === 401 || status === 403) return MERCADOPAGO_ERROR_CATEGORY.AUTH;
  if (status === 409) return MERCADOPAGO_ERROR_CATEGORY.CONFLICT;
  if (status === 429) return MERCADOPAGO_ERROR_CATEGORY.RATE_LIMIT;
  if (status >= 500) return MERCADOPAGO_ERROR_CATEGORY.TRANSIENT;
  return MERCADOPAGO_ERROR_CATEGORY.UNKNOWN;
}

const DETAIL_MAX_LENGTH = 300;

function extractOrderBody(payload: unknown): unknown {
  const parsed = mercadoPagoErrorResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data === undefined) return undefined;

  try {
    toMercadoPagoOrder(parsed.data.data);
    return parsed.data.data;
  } catch {
    return undefined;
  }
}

/** Error codes and detail strings (property paths, transaction ids). Long alphanumeric runs are redacted in case a value is echoed. */
function describeDetails(errors: ReadonlyArray<{ code?: string | undefined; details?: unknown[] | undefined }> | undefined): string | undefined {
  if (!errors || errors.length === 0) return undefined;

  const text = errors
    .map((error) => [error.code, ...(error.details ?? []).filter((detail): detail is string => typeof detail === "string")].filter(Boolean).join(": "))
    .join("; ")
    .replace(/[A-Za-z0-9]{21,}/g, "[redacted]");

  return text ? text.slice(0, DETAIL_MAX_LENGTH) : undefined;
}

function sanitizeCode(code: string | undefined): string | undefined {
  return code && /^[\w.-]{1,80}$/.test(code) ? code : undefined;
}
