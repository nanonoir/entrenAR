import { salesApiConfig } from "./sales-api-config";
import {
  clearAccountAccessToken,
  getAccountAccessToken,
  setAccountAccessToken,
} from "@/lib/api/account/access-token";

const SALES_API_HTTP_METHOD = {
  DELETE: "DELETE",
  GET: "GET",
  PATCH: "PATCH",
  POST: "POST",
  PUT: "PUT",
} as const;

type SalesApiHttpMethod = (typeof SALES_API_HTTP_METHOD)[keyof typeof SALES_API_HTTP_METHOD];

export interface SalesApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: SalesApiHttpMethod;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export type SalesApiMethodOptions = Omit<SalesApiRequestOptions, "body" | "method">;

export interface SalesApiIssue {
  code: string;
  field: string;
  message: string;
}

export class SalesApiError extends Error {
  readonly code: string;
  readonly issues: readonly SalesApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({
    code,
    issues = [],
    message,
    status,
  }: {
    code: string;
    issues?: readonly SalesApiIssue[];
    message: string;
    status: number;
  }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "SalesApiError";
    this.status = status;
  }
}

export interface SalesApiClient {
  delete<T>(path: string, options?: SalesApiMethodOptions): Promise<T>;
  get<T>(path: string, options?: SalesApiMethodOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: SalesApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: SalesApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: SalesApiMethodOptions): Promise<T>;
  request<T>(path: string, options?: SalesApiRequestOptions): Promise<T>;
}

export function toSalesApiError(
  error: unknown,
  fallbackCode = "SALES_API_ERROR",
  fallbackMessage = "The sales request could not be completed.",
): SalesApiError {
  if (error instanceof SalesApiError) return error;

  return new SalesApiError({
    code: fallbackCode,
    message: fallbackMessage,
    status: 500,
  });
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchSalesApiClient implements SalesApiClient {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = salesApiConfig.baseUrl,
  ) {}

  delete<T>(path: string, options: SalesApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: SALES_API_HTTP_METHOD.DELETE });
  }

  get<T>(path: string, options: SalesApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: SALES_API_HTTP_METHOD.GET });
  }

  patch<T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: SALES_API_HTTP_METHOD.PATCH });
  }

  post<T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: SALES_API_HTTP_METHOD.POST });
  }

  put<T>(path: string, body?: unknown, options: SalesApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: SALES_API_HTTP_METHOD.PUT });
  }

  async request<T>(path: string, options: SalesApiRequestOptions = {}): Promise<T> {
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

  private async execute(path: string, options: SalesApiRequestOptions): Promise<Response> {
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
      method: options.method ?? SALES_API_HTTP_METHOD.GET,
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
        method: SALES_API_HTTP_METHOD.POST,
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
      throw new SalesApiError({
        code: "SALES_API_INVALID_RESPONSE",
        message: "The sales API returned an invalid refresh response.",
        status: 502,
      });
    }

    setAccountAccessToken(accessToken);
    return accessToken;
  }
}

export { SALES_API_HTTP_METHOD };

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

function createResponseError(status: number, payload: unknown): SalesApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "SALES_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim()
    ? record.message
    : "The sales API request failed.";

  return new SalesApiError({
    code,
    issues: readIssues(record.issues),
    message,
    status,
  });
}

function readAccessToken(payload: unknown): string | undefined {
  if (!isRecord(payload) || typeof payload.accessToken !== "string" || !payload.accessToken.trim()) return undefined;
  return payload.accessToken;
}

function readIssues(value: unknown): SalesApiIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const code = typeof item.code === "string" && item.code.trim() ? item.code : "INVALID_FIELD";
    const field = typeof item.field === "string" && item.field.trim() ? item.field : "request";
    const message = typeof item.message === "string" && item.message.trim() ? item.message : "Invalid value.";

    return [{ code, field, message }];
  });
}

function unavailableError(): SalesApiError {
  return new SalesApiError({
    code: "SALES_API_UNAVAILABLE",
    message: "The sales API is unavailable.",
    status: 503,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
