import { commerceApiConfig } from "@/lib/api/config";
import { AdminApiClient, AdminApiError, type AdminRequestOptions } from "@/lib/api/admin/client";

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
  private readonly adminClient: AdminApiClient;

  constructor(
    fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = commerceApiConfig.baseUrl,
  ) { this.adminClient = new AdminApiClient(fetchImplementation, baseUrl); }

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
    try {
      return await this.adminClient.request<T>(path, toAdminOptions(options));
    } catch (error) {
      if (error instanceof AdminApiError) throw new CommerceApiError({ code: error.status === 503 ? "COMMERCE_API_UNAVAILABLE" : error.code, issues: error.issues.flatMap((issue) => isRecord(issue) ? [{ code: String(issue.code ?? "INVALID_FIELD"), field: String(issue.field ?? "request"), message: String(issue.message ?? "Invalid value.") }] : []), message: error.message, status: error.status });
      throw error;
    }
  }
}

function toAdminOptions(options: CommerceApiRequestOptions): AdminRequestOptions { return { ...options, retryOnUnauthorized: true }; }

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
