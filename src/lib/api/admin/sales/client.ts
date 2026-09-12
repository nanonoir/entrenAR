import { salesApiConfig } from "./sales-api-config";
import { AdminApiClient, AdminApiError, type AdminRequestOptions } from "@/lib/api/admin/client";

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
  private readonly adminClient: AdminApiClient;

  constructor(
    fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = salesApiConfig.baseUrl,
  ) { this.adminClient = new AdminApiClient(fetchImplementation, baseUrl); }

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
    try {
      return await this.adminClient.request<T>(path, toAdminOptions(options));
    } catch (error) {
      if (error instanceof AdminApiError) throw new SalesApiError({ code: error.status === 503 ? "SALES_API_UNAVAILABLE" : error.code, issues: error.issues.flatMap((issue) => isRecord(issue) ? [{ code: String(issue.code ?? "INVALID_FIELD"), field: String(issue.field ?? "request"), message: String(issue.message ?? "Invalid value.") }] : []), message: error.message, status: error.status });
      throw error;
    }
  }
}

function toAdminOptions(options: SalesApiRequestOptions): AdminRequestOptions { return { ...options, retryOnUnauthorized: true }; }

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
