import { clearAdminAccessToken, getAdminAccessToken, setAdminAccessToken } from "./auth/admin-access-token";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface AdminRequestOptions extends Omit<RequestInit, "body" | "method"> {
  body?: unknown;
  method?: string;
  retryOnUnauthorized?: boolean;
}

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues: readonly unknown[];

  constructor(status: number, code: string, message: string, issues: readonly unknown[] = []) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

let refreshPromise: Promise<string> | null = null;
let requestGeneration = 0;
const pendingControllers = new Set<AbortController>();

export function getAdminRequestGeneration(): number {
  return requestGeneration;
}

export function invalidateAdminRequests(): void {
  requestGeneration += 1;
  for (const controller of pendingControllers) controller.abort();
  pendingControllers.clear();
  refreshPromise = null;
}

export function clearAdminRefreshState(): void {
  refreshPromise = null;
}

export class AdminApiClient {
  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = API_BASE_URL,
  ) {}

  get<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  delete<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  patch<T>(path: string, body?: unknown, options: AdminRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "PATCH" });
  }

  post<T>(path: string, body?: unknown, options: AdminRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "POST" });
  }

  put<T>(path: string, body?: unknown, options: AdminRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "PUT" });
  }

  request<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
    return this.requestOnce<T>(path, options, true);
  }

  async requestText(path: string, options: AdminRequestOptions = {}): Promise<string> {
    return this.readText(await this.requestRaw(path, options));
  }

  async requestRaw(path: string, options: AdminRequestOptions = {}): Promise<Response> {
    const response = await this.execute(path, options);
    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      const token = await this.refreshAccessToken();
      return this.execute(path, { ...options, retryOnUnauthorized: false }, token);
    }
    if (!response.ok) throw responseError(response.status, await readJson(response));
    return response;
  }

  private async requestOnce<T>(path: string, options: AdminRequestOptions, mayRetry: boolean, token = getAdminAccessToken()): Promise<T> {
    const generation = requestGeneration;
    const response = await this.execute(path, options, token);
    if (response.status === 401 && mayRetry && options.retryOnUnauthorized !== false) {
      const token = await this.refreshAccessToken();
      if (generation !== requestGeneration) throw new AdminApiError(401, "ADMIN_SESSION_ENDED", "The administrator session ended.");
      return this.requestOnce<T>(path, { ...options, retryOnUnauthorized: false }, false, token);
    }
    if (generation !== requestGeneration) throw new AdminApiError(499, "ADMIN_REQUEST_ABORTED", "The administrator request was invalidated.");
    return this.readResponse<T>(response);
  }

  private async execute(path: string, options: AdminRequestOptions, token = getAdminAccessToken()): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    pendingControllers.add(controller);
    try {
      return await this.fetchImplementation(`${this.baseUrl}${normalizePath(path)}`, {
        ...options,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        credentials: "include",
        headers,
        method: options.method ?? "GET",
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw new AdminApiError(499, "ADMIN_REQUEST_ABORTED", "The administrator request was aborted.");
      throw new AdminApiError(503, "ADMIN_API_UNAVAILABLE", "The administrator API is unavailable.");
    } finally {
      pendingControllers.delete(controller);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  private async refreshAccessToken(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = this.performRefresh().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  private async performRefresh(): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchImplementation("/api/admin-session/refresh", { cache: "no-store", credentials: "include", method: "POST" });
    } catch {
      clearAdminAccessToken();
      throw new AdminApiError(503, "ADMIN_AUTH_UNAVAILABLE", "The administrator session is unavailable.");
    }
    const payload = await readJson(response);
    if (!response.ok) {
      clearAdminAccessToken();
      throw responseError(response.status, payload);
    }
    const token = isRecord(payload) && typeof payload.accessToken === "string" ? payload.accessToken : undefined;
    if (!token) throw new AdminApiError(502, "ADMIN_AUTH_INVALID_RESPONSE", "The administrator session response was invalid.");
    setAdminAccessToken(token);
    return token;
  }

  private async readResponse<T>(response: Response): Promise<T> {
    const payload = await readJson(response);
    if (!response.ok) throw responseError(response.status, payload);
    return payload as T;
  }

  private async readText(response: Response): Promise<string> {
    if (!response.ok) throw responseError(response.status, await readJson(response));
    return response.text();
  }
}

export const adminClient = new AdminApiClient();

function normalizePath(path: string): string { return path.startsWith("/") ? path : `/${path}`; }
async function readJson(response: Response): Promise<unknown> { const text = await response.text().catch(() => ""); if (!text.trim()) return undefined; try { return JSON.parse(text) as unknown; } catch { return undefined; } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function responseError(status: number, payload: unknown): AdminApiError {
  const record = isRecord(payload) ? payload : {};
  return new AdminApiError(status, typeof record.code === "string" ? record.code : "ADMIN_API_ERROR", typeof record.message === "string" ? record.message : "The administrator request failed.", Array.isArray(record.issues) ? record.issues : []);
}
