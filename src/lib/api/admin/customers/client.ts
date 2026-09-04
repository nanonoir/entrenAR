import { clearAccountAccessToken, getAccountAccessToken } from "@/lib/api/account/access-token";

import { customersApiConfig } from "./customers-api-config";
import type { CustomerApiIssue } from "./types";

export interface CustomersApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: "GET" | "PATCH" | "POST" | "PUT";
  signal?: AbortSignal;
}

export type CustomersApiMethodOptions = Omit<CustomersApiRequestOptions, "body" | "method">;

export class CustomersApiError extends Error {
  readonly code: string;
  readonly issues: readonly CustomerApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({ code, issues = [], message, status }: { code: string; issues?: readonly CustomerApiIssue[]; message: string; status: number }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "CustomersApiError";
    this.status = status;
  }
}

export interface CustomersApiClient {
  get<T>(path: string, options?: CustomersApiMethodOptions): Promise<T>;
  getText(path: string, options?: CustomersApiMethodOptions): Promise<string>;
  patch<T>(path: string, body?: unknown, options?: CustomersApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: CustomersApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: CustomersApiMethodOptions): Promise<T>;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchCustomersApiClient implements CustomersApiClient {
  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = customersApiConfig.baseUrl,
  ) {}

  get<T>(path: string, options: CustomersApiMethodOptions = {}): Promise<T> { return this.request<T>(path, { ...options, method: "GET" }); }
  getText(path: string, options: CustomersApiMethodOptions = {}): Promise<string> { return this.requestText(path, { ...options, method: "GET" }); }
  patch<T>(path: string, body?: unknown, options: CustomersApiMethodOptions = {}): Promise<T> { return this.request<T>(path, { ...options, body, method: "PATCH" }); }
  post<T>(path: string, body?: unknown, options: CustomersApiMethodOptions = {}): Promise<T> { return this.request<T>(path, { ...options, body, method: "POST" }); }
  put<T>(path: string, body?: unknown, options: CustomersApiMethodOptions = {}): Promise<T> { return this.request<T>(path, { ...options, body, method: "PUT" }); }

  private async request<T>(path: string, options: CustomersApiRequestOptions): Promise<T> {
    const response = await this.execute(path, options);
    const payload = await readJson(response);
    if (!response.ok) throw responseError(response.status, payload);
    if (isRecord(payload) && payload.ok === false) throw responseError(response.status, payload);
    return payload as T;
  }

  private async requestText(path: string, options: CustomersApiRequestOptions): Promise<string> {
    const response = await this.execute(path, options);
    const text = await response.text();
    if (!response.ok) throw responseError(response.status, parseJson(text));
    return text.startsWith("\uFEFF") ? text : `\uFEFF${text}`;
  }

  private async execute(path: string, options: CustomersApiRequestOptions): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", options.method === "GET" && path.includes("/export") ? "text/csv" : "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    const token = getAccountAccessToken();
    if (token && options.includeAuthorization !== false) headers.set("Authorization", `Bearer ${token}`);
    try {
      return await this.fetchImplementation(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        credentials: "include",
        headers,
        method: options.method ?? "GET",
        signal: options.signal,
      });
    } catch {
      throw new CustomersApiError({ code: "CUSTOMERS_API_UNAVAILABLE", message: "The customers API is unavailable.", status: 503 });
    }
  }
}

export function toCustomersApiError(error: unknown): CustomersApiError {
  return error instanceof CustomersApiError
    ? error
    : new CustomersApiError({ code: "CUSTOMERS_API_ERROR", message: error instanceof Error ? error.message : "The customers request failed.", status: 500 });
}

function responseError(status: number, payload: unknown): CustomersApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "CUSTOMERS_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim() ? record.message : "The customers request failed.";
  if (status === 401) clearAccountAccessToken();
  return new CustomersApiError({ code, issues: readIssues(record.issues), message, status });
}

function readJson(response: Response): Promise<unknown> { return response.text().then(parseJson).catch(() => undefined); }
function parseJson(value: string): unknown { if (!value.trim()) return undefined; try { return JSON.parse(value) as unknown; } catch { return undefined; } }
function readIssues(value: unknown): CustomerApiIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => isRecord(item) ? [{ code: String(item.code ?? "INVALID_FIELD"), field: String(item.field ?? "request"), message: String(item.message ?? "Invalid value.") }] : []);
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
