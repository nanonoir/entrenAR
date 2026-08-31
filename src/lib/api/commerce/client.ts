import { commerceApiConfig } from "@/lib/api/config";
import {
  clearAccountAccessToken,
  getAccountAccessToken,
  setAccountAccessToken,
} from "@/lib/api/account/client";

const COMMERCE_API_HTTP_METHOD = {
  DELETE: "DELETE",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

type CommerceApiHttpMethod = (typeof COMMERCE_API_HTTP_METHOD)[keyof typeof COMMERCE_API_HTTP_METHOD];

export interface CommerceApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: CommerceApiHttpMethod;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export type CommerceApiMethodOptions = Omit<CommerceApiRequestOptions, "body" | "method">;

export interface CommerceApiIssue {
  code: string;
  field: string;
  message: string;
}

export interface CommerceApiErrorPayload {
  code?: unknown;
  issues?: unknown;
  message?: unknown;
  ok?: unknown;
}

export class CommerceApiError extends Error {
  readonly code: string;
  readonly issues: readonly CommerceApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({
    code,
    issues = [],
    message,
    status,
  }: {
    code: string;
    issues?: readonly CommerceApiIssue[];
    message: string;
    status: number;
  }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "CommerceApiError";
    this.status = status;
  }
}

export interface CommerceApiClient {
  delete<T>(path: string, options?: CommerceApiMethodOptions): Promise<T>;
  get<T>(path: string, options?: CommerceApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: CommerceApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: CommerceApiMethodOptions): Promise<T>;
  request<T>(path: string, options?: CommerceApiRequestOptions): Promise<T>;
}

export function toCommerceApiError(
  error: unknown,
  fallbackCode = "COMMERCE_API_ERROR",
  fallbackMessage = "The commerce request could not be completed.",
): CommerceApiError {
  if (error instanceof CommerceApiError) return error;

  return new CommerceApiError({
    code: fallbackCode,
    message: fallbackMessage,
    status: 500,
  });
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchCommerceApiClient implements CommerceApiClient {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = commerceApiConfig.baseUrl,
  ) {}

  delete<T>(path: string, options: CommerceApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: COMMERCE_API_HTTP_METHOD.DELETE });
  }

  get<T>(path: string, options: CommerceApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: COMMERCE_API_HTTP_METHOD.GET });
  }

  post<T>(path: string, body?: unknown, options: CommerceApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: COMMERCE_API_HTTP_METHOD.POST });
  }

  put<T>(path: string, body?: unknown, options: CommerceApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: COMMERCE_API_HTTP_METHOD.PUT });
  }

  async request<T>(path: string, options: CommerceApiRequestOptions = {}): Promise<T> {
    const response = await this.execute(path, options);
    const includeAuthorization = options.includeAuthorization !== false;

    if (
      response.status === 401
      && includeAuthorization
      && options.retryOnUnauthorized !== false
      && !isRefreshPath(path)
    ) {
      await this.refreshAccessToken();
      const retryResponse = await this.execute(path, { ...options, retryOnUnauthorized: false });
      return this.readResponse<T>(retryResponse, includeAuthorization);
    }

    return this.readResponse<T>(response, includeAuthorization);
  }

  private async execute(path: string, options: CommerceApiRequestOptions): Promise<Response> {
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
      method: options.method ?? COMMERCE_API_HTTP_METHOD.GET,
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
        method: COMMERCE_API_HTTP_METHOD.POST,
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
      throw new CommerceApiError({
        code: "COMMERCE_API_INVALID_RESPONSE",
        message: "The commerce API returned an invalid refresh response.",
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

function createResponseError(status: number, payload: unknown): CommerceApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "COMMERCE_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim()
    ? record.message
    : "The commerce API request failed.";

  return new CommerceApiError({
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

function readIssues(value: unknown): CommerceApiIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const code = typeof item.code === "string" && item.code.trim() ? item.code : "INVALID_FIELD";
    const field = typeof item.field === "string" && item.field.trim() ? item.field : "request";
    const message = typeof item.message === "string" && item.message.trim() ? item.message : "Invalid value.";

    return [{ code, field, message }];
  });
}

function unavailableError(): CommerceApiError {
  return new CommerceApiError({
    code: "COMMERCE_API_UNAVAILABLE",
    message: "The commerce API is unavailable.",
    status: 503,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
