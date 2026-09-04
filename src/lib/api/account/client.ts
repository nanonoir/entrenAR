import { accountApiConfig } from "@/lib/api/config";
import type { AccountApiIssue } from "@/types/account";
import {
  clearAccountAccessToken,
  getAccountAccessToken,
  setAccountAccessToken,
} from "./access-token";

const ACCOUNT_API_HTTP_METHOD = {
  DELETE: "DELETE",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

type AccountApiHttpMethod = (typeof ACCOUNT_API_HTTP_METHOD)[keyof typeof ACCOUNT_API_HTTP_METHOD];

export interface AccountApiRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: AccountApiHttpMethod;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export type AccountApiMethodOptions = Omit<AccountApiRequestOptions, "body" | "method">;

export type AccountApiErrorPayload = {
  code?: unknown;
  issues?: unknown;
  message?: unknown;
  ok?: unknown;
};

export class AccountApiError extends Error {
  readonly code: string;
  readonly issues: readonly AccountApiIssue[];
  readonly status: number;

  constructor({
    code,
    issues = [],
    message,
    status,
  }: {
    code: string;
    issues?: readonly AccountApiIssue[];
    message: string;
    status: number;
  }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "AccountApiError";
    this.status = status;
  }
}

export interface AccountApiClient {
  delete<T>(path: string, options?: AccountApiMethodOptions): Promise<T>;
  get<T>(path: string, options?: AccountApiMethodOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: AccountApiMethodOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: AccountApiMethodOptions): Promise<T>;
  request<T>(path: string, options?: AccountApiRequestOptions): Promise<T>;
}

export { clearAccountAccessToken, getAccountAccessToken, setAccountAccessToken } from "./access-token";

export function toAccountApiError(
  error: unknown,
  fallbackCode = "ACCOUNT_API_ERROR",
  fallbackMessage = "The account request could not be completed.",
): AccountApiError {
  if (error instanceof AccountApiError) {
    return error;
  }

  return new AccountApiError({
    code: fallbackCode,
    message: fallbackMessage,
    status: 500,
  });
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchAccountApiClient implements AccountApiClient {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = accountApiConfig.baseUrl,
  ) {}

  delete<T>(path: string, options: AccountApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: ACCOUNT_API_HTTP_METHOD.DELETE });
  }

  get<T>(path: string, options: AccountApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: ACCOUNT_API_HTTP_METHOD.GET });
  }

  post<T>(path: string, body?: unknown, options: AccountApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: ACCOUNT_API_HTTP_METHOD.POST });
  }

  put<T>(path: string, body?: unknown, options: AccountApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: ACCOUNT_API_HTTP_METHOD.PUT });
  }

  async request<T>(path: string, options: AccountApiRequestOptions = {}): Promise<T> {
    const response = await this.execute(path, options);
    const includeAuthorization = options.includeAuthorization !== false;

    if (
      response.status === 401 &&
      includeAuthorization &&
      options.retryOnUnauthorized !== false &&
      !isRefreshPath(path)
    ) {
      await this.refreshAccessToken();
      const retryResponse = await this.execute(path, { ...options, retryOnUnauthorized: false });
      return this.readResponse<T>(retryResponse, includeAuthorization);
    }

    return this.readResponse<T>(response, includeAuthorization);
  }

  private async execute(path: string, options: AccountApiRequestOptions): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    const hasBody = options.body !== undefined;
    if (hasBody) {
      headers.set("Content-Type", "application/json");
    }

    const accessToken = getAccountAccessToken();
    if (accessToken && options.includeAuthorization !== false) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const requestInit: RequestInit = {
      cache: "no-store",
      credentials: "include",
      headers,
      method: options.method ?? "GET",
      signal: options.signal,
    };

    if (hasBody) {
      requestInit.body = JSON.stringify(options.body);
    }

    try {
      return await this.fetchImplementation(`${this.baseUrl}${normalizePath(path)}`, requestInit);
    } catch {
      throw new AccountApiError({
        code: "ACCOUNT_API_UNAVAILABLE",
        message: "The account API is unavailable.",
        status: 503,
      });
    }
  }

  private async readResponse<T>(response: Response, clearTokenOnUnauthorized = true): Promise<T> {
    const payload = await readJson(response);

    if (!response.ok) {
      if (response.status === 401 && clearTokenOnUnauthorized) {
        clearAccountAccessToken();
      }

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
        method: "POST",
      });
    } catch {
      clearAccountAccessToken();
      throw new AccountApiError({
        code: "ACCOUNT_API_UNAVAILABLE",
        message: "The account API is unavailable.",
        status: 503,
      });
    }

    const payload = await readJson(response);
    if (!response.ok) {
      clearAccountAccessToken();
      throw createResponseError(response.status, payload);
    }

    const accessToken = readAccessToken(payload);
    if (!accessToken) {
      clearAccountAccessToken();
      throw new AccountApiError({
        code: "ACCOUNT_API_INVALID_RESPONSE",
        message: "The account API returned an invalid refresh response.",
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

  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function createResponseError(status: number, payload: unknown): AccountApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "ACCOUNT_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim()
    ? record.message
    : "The account API request failed.";

  return new AccountApiError({
    code,
    issues: readIssues(record.issues),
    message,
    status,
  });
}

function readAccessToken(payload: unknown): string | undefined {
  if (!isRecord(payload) || typeof payload.accessToken !== "string" || !payload.accessToken.trim()) {
    return undefined;
  }

  return payload.accessToken;
}

function readIssues(value: unknown): AccountApiIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const code = typeof item.code === "string" ? item.code : "INVALID_FIELD";
    const field = typeof item.field === "string" ? item.field : "request";
    const message = typeof item.message === "string" ? item.message : "Invalid value.";

    return [{ code, field, message }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
