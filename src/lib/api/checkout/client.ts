import { checkoutApiConfig } from "@/lib/api/config";
import {
  clearAccountAccessToken,
  getAccountAccessToken,
  setAccountAccessToken,
} from "@/lib/api/account/client";
import type { CheckoutApiIssue, CheckoutOperationError } from "@/lib/api/checkout/checkout.repository";

const CHECKOUT_API_HTTP_METHOD = {
  DELETE: "DELETE",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

type CheckoutApiHttpMethod = (typeof CHECKOUT_API_HTTP_METHOD)[keyof typeof CHECKOUT_API_HTTP_METHOD];

export interface CheckoutApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: CheckoutApiHttpMethod;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export type CheckoutApiMethodOptions = Omit<CheckoutApiRequestOptions, "body" | "method">;

export interface CheckoutApiErrorPayload {
  code?: unknown;
  field?: unknown;
  issues?: unknown;
  message?: unknown;
  ok?: unknown;
}

export class CheckoutApiError extends Error implements CheckoutOperationError {
  readonly code: string;
  readonly issues: readonly CheckoutApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({
    code,
    issues = [],
    message,
    status,
  }: {
    code: string;
    issues?: readonly CheckoutApiIssue[];
    message: string;
    status: number;
  }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "CheckoutApiError";
    this.status = status;
  }
}

export interface CheckoutApiClient {
  delete<T>(path: string, options?: CheckoutApiMethodOptions): Promise<T>;
  get<T>(path: string, options?: CheckoutApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: CheckoutApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: CheckoutApiMethodOptions): Promise<T>;
  request<T>(path: string, options?: CheckoutApiRequestOptions): Promise<T>;
}

export function toCheckoutApiError(
  error: unknown,
  fallbackCode = "CHECKOUT_API_ERROR",
  fallbackMessage = "The checkout request could not be completed.",
): CheckoutApiError {
  if (error instanceof CheckoutApiError) return error;

  return new CheckoutApiError({
    code: fallbackCode,
    message: fallbackMessage,
    status: 500,
  });
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchCheckoutApiClient implements CheckoutApiClient {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = checkoutApiConfig.baseUrl,
  ) {}

  delete<T>(path: string, options: CheckoutApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: CHECKOUT_API_HTTP_METHOD.DELETE });
  }

  get<T>(path: string, options: CheckoutApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: CHECKOUT_API_HTTP_METHOD.GET });
  }

  post<T>(path: string, body?: unknown, options: CheckoutApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: CHECKOUT_API_HTTP_METHOD.POST });
  }

  put<T>(path: string, body?: unknown, options: CheckoutApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: CHECKOUT_API_HTTP_METHOD.PUT });
  }

  async request<T>(path: string, options: CheckoutApiRequestOptions = {}): Promise<T> {
    const response = await this.execute(path, options);
    const includeAuthorization = options.includeAuthorization !== false;

    if (
      response.status === 401
      && includeAuthorization
      && getAccountAccessToken()
      && options.retryOnUnauthorized !== false
      && !isRefreshPath(path)
    ) {
      await this.refreshAccessToken();
      const retryResponse = await this.execute(path, { ...options, retryOnUnauthorized: false });
      return this.readResponse<T>(retryResponse, includeAuthorization);
    }

    return this.readResponse<T>(response, includeAuthorization);
  }

  private async execute(path: string, options: CheckoutApiRequestOptions): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    const hasBody = options.body !== undefined;
    if (hasBody) headers.set("Content-Type", "application/json");

    const accessToken = getAccountAccessToken();
    if (accessToken && options.includeAuthorization !== false) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const requestInit: RequestInit = {
      cache: "no-store",
      credentials: "include",
      headers,
      method: options.method ?? CHECKOUT_API_HTTP_METHOD.GET,
      signal: options.signal,
    };

    if (hasBody) requestInit.body = JSON.stringify(options.body);

    try {
      return await this.fetchImplementation(`${this.baseUrl}${normalizePath(path)}`, requestInit);
    } catch {
      throw unavailableError();
    }
  }

  private async readResponse<T>(response: Response, clearTokenOnUnauthorized = true): Promise<T> {
    const payload = await readJson(response);

    if (!response.ok) {
      if (response.status === 401 && clearTokenOnUnauthorized) clearAccountAccessToken();
      throw createResponseError(response.status, payload);
    }

    return payload as T;
  }

  private refreshAccessToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string> {
    let response: Response;

    try {
      response = await this.fetchImplementation(`${this.baseUrl}/auth/refresh`, {
        cache: "no-store",
        credentials: "include",
        headers: new Headers({ Accept: "application/json" }),
        method: CHECKOUT_API_HTTP_METHOD.POST,
      });
    } catch {
      clearAccountAccessToken();
      throw unavailableError();
    }

    const payload = await readJson(response);
    if (!response.ok) {
      clearAccountAccessToken();
      throw createResponseError(response.status, payload);
    }

    const accessToken = readAccessToken(payload);
    if (!accessToken) {
      clearAccountAccessToken();
      throw new CheckoutApiError({
        code: "CHECKOUT_API_INVALID_RESPONSE",
        message: "The checkout API returned an invalid refresh response.",
        status: 502,
      });
    }

    setAccountAccessToken(accessToken);
    return accessToken;
  }
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isRefreshPath(path: string): boolean {
  return normalizePath(path).split("?", 1)[0] === "/auth/refresh";
}

async function readJson(response: Response): Promise<unknown> {
  let text: string;

  try {
    text = await response.text();
  } catch {
    return undefined;
  }

  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function createResponseError(status: number, payload: unknown): CheckoutApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "CHECKOUT_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim()
    ? record.message
    : "The checkout API request failed.";
  const issues = readIssues(record.issues, record.field);

  return new CheckoutApiError({ code, issues, message, status });
}

function readAccessToken(payload: unknown): string | undefined {
  if (!isRecord(payload) || typeof payload.accessToken !== "string" || !payload.accessToken.trim()) return undefined;
  return payload.accessToken;
}

function readIssues(value: unknown, field: unknown): CheckoutApiIssue[] {
  const issues = Array.isArray(value)
    ? value.flatMap((item) => {
      if (!isRecord(item)) return [];

      const code = typeof item.code === "string" && item.code.trim() ? item.code : "INVALID_FIELD";
      const issueField = typeof item.field === "string" && item.field.trim() ? item.field : "request";
      const message = typeof item.message === "string" && item.message.trim() ? item.message : "Invalid value.";

      return [{ code, field: issueField, message }];
    })
    : [];

  if (issues.length > 0 || typeof field !== "string" || !field.trim()) return issues;

  return [{ code: "INVALID_FIELD", field: field.trim(), message: "Invalid value." }];
}

function unavailableError(): CheckoutApiError {
  return new CheckoutApiError({
    code: "CHECKOUT_API_UNAVAILABLE",
    message: "The checkout API is unavailable.",
    status: 503,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
