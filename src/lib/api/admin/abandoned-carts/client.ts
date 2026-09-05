import { clearAccountAccessToken, getAccountAccessToken } from "@/lib/api/account/access-token";

import { abandonedCartsApiConfig } from "./abandoned-carts-api-config";
import type { AbandonedCartsApiIssue } from "./types";

const ABANDONED_CARTS_API_HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

type AbandonedCartsApiHttpMethod = (typeof ABANDONED_CARTS_API_HTTP_METHOD)[keyof typeof ABANDONED_CARTS_API_HTTP_METHOD];

export interface AbandonedCartsApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: AbandonedCartsApiHttpMethod;
  signal?: AbortSignal;
}

export type AbandonedCartsApiMethodOptions = Omit<AbandonedCartsApiRequestOptions, "body" | "method">;

export class AbandonedCartsApiError extends Error {
  readonly code: string;
  readonly issues: readonly AbandonedCartsApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({ code, issues = [], message, status }: { code: string; issues?: readonly AbandonedCartsApiIssue[]; message: string; status: number }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "AbandonedCartsApiError";
    this.status = status;
  }
}

export interface AbandonedCartsApiClient {
  get<T>(path: string, options?: AbandonedCartsApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: AbandonedCartsApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: AbandonedCartsApiMethodOptions): Promise<T>;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchAbandonedCartsApiClient implements AbandonedCartsApiClient {
  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = abandonedCartsApiConfig.baseUrl,
  ) {}

  get<T>(path: string, options: AbandonedCartsApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: ABANDONED_CARTS_API_HTTP_METHOD.GET });
  }

  post<T>(path: string, body?: unknown, options: AbandonedCartsApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: ABANDONED_CARTS_API_HTTP_METHOD.POST });
  }

  put<T>(path: string, body?: unknown, options: AbandonedCartsApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: ABANDONED_CARTS_API_HTTP_METHOD.PUT });
  }

  private async request<T>(path: string, options: AbandonedCartsApiRequestOptions): Promise<T> {
    const response = await this.execute(path, options);
    const payload = await readJson(response);
    if (!response.ok) {
      if (response.status === 401 && options.includeAuthorization !== false) clearAccountAccessToken();
      throw responseError(response.status, payload);
    }
    if (isRecord(payload) && payload.ok === false) throw responseError(response.status, payload);
    return payload as T;
  }

  private async execute(path: string, options: AbandonedCartsApiRequestOptions): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    const accessToken = getAccountAccessToken();
    if (accessToken && options.includeAuthorization !== false) headers.set("Authorization", `Bearer ${accessToken}`);

    try {
      return await this.fetchImplementation(`${this.baseUrl}${normalizePath(path)}`, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        credentials: "include",
        headers,
        method: options.method ?? ABANDONED_CARTS_API_HTTP_METHOD.GET,
        signal: options.signal,
      });
    } catch {
      throw unavailableError();
    }
  }
}

export function toAbandonedCartsApiError(error: unknown): AbandonedCartsApiError {
  if (error instanceof AbandonedCartsApiError) return error;
  return new AbandonedCartsApiError({
    code: "ABANDONED_CARTS_API_ERROR",
    message: error instanceof Error ? error.message : "The abandoned-carts request failed.",
    status: 500,
  });
}

export { ABANDONED_CARTS_API_HTTP_METHOD };

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function responseError(status: number, payload: unknown): AbandonedCartsApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "ABANDONED_CARTS_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim() ? record.message : "The abandoned-carts request failed.";
  return new AbandonedCartsApiError({ code, issues: readIssues(record.issues), message, status });
}

function unavailableError(): AbandonedCartsApiError {
  return new AbandonedCartsApiError({
    code: "ABANDONED_CARTS_API_UNAVAILABLE",
    message: "The abandoned-carts API is unavailable.",
    status: 503,
  });
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

function readIssues(value: unknown): AbandonedCartsApiIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      code: typeof item.code === "string" && item.code.trim() ? item.code : "INVALID_FIELD",
      field: typeof item.field === "string" && item.field.trim() ? item.field : "request",
      message: typeof item.message === "string" && item.message.trim() ? item.message : "Invalid value.",
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
