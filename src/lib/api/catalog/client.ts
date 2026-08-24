import { catalogApiConfig } from "@/lib/api/config";

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
  async get<T>(path: string, options: { admin?: boolean } = {}): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });

    if (options.admin && catalogApiConfig.adminAccessToken) {
      headers.set("Authorization", `Bearer ${catalogApiConfig.adminAccessToken}`);
    }

    let response: Response;

    try {
      response = await fetch(`${catalogApiConfig.baseUrl}${path}`, {
        headers,
        next: { revalidate: 0 },
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
