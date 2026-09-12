import { catalogApiConfig } from "@/lib/api/config";
import { AdminApiClient, AdminApiError } from "@/lib/api/admin/client";

export type CatalogApiErrorPayload = {
  code?: string;
  message?: string;
  ok?: false;
};

export class CatalogApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ code, message, status }: { code: string; message: string; status: number }) {
    super(message);
    this.code = code;
    this.name = "CatalogApiError";
    this.status = status;
  }
}

export interface CatalogApiClient {
  get<T>(path: string, options?: { admin?: boolean }): Promise<T>;
}

export class FetchCatalogApiClient implements CatalogApiClient {
  private readonly adminClient: AdminApiClient;

  constructor(fetchImplementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch) {
    this.adminClient = new AdminApiClient(fetchImplementation, catalogApiConfig.baseUrl);
  }

  async get<T>(path: string, options: { admin?: boolean } = {}): Promise<T> {
    if (options.admin) {
      try {
        return await this.adminClient.request<T>(path);
      } catch (error) {
        if (error instanceof AdminApiError) throw new CatalogApiError({ code: error.code, message: error.message, status: error.status });
        throw error;
      }
    }
    const headers = new Headers({ Accept: "application/json" });

    let response: Response;

    try {
      response = await fetch(`${catalogApiConfig.baseUrl}${path}`, {
        headers,
        cache: "no-store",
      });
    } catch {
      throw new CatalogApiError({
        code: "CATALOG_API_UNAVAILABLE",
        message: "The catalog API is unavailable.",
        status: 503,
      });
    }

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    const payload = await response.json().catch(() => null) as CatalogApiErrorPayload | null;
    throw new CatalogApiError({
      code: payload?.code ?? "CATALOG_API_ERROR",
      message: payload?.message ?? "The catalog API request failed.",
      status: response.status,
    });
  }
}
