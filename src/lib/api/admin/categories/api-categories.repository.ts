import { z } from "zod";
import { AdminApiClient, AdminApiError } from "@/lib/api/admin/client";
import { catalogApiConfig } from "@/lib/api/config";
import type { AdminProductCategory } from "@/types/admin-product";
import type { AdminCategoriesRepository } from "./repository";
import { ADMIN_CATEGORIES_ERROR_CODE, AdminCategoriesApiError, type AdminCategoryInput, type AdminCategoryUpdateInput, type AdminCategoryVisibility } from "./types";

const categoryBase = {
  description: z.string().optional(),
  googleShoppingCategory: z.string().optional(),
  id: z.string().min(1),
  imageUrl: z.string().optional(),
  name: z.string().min(1),
  parentId: z.string().optional(),
  seoDescription: z.string().optional(),
  seoTitle: z.string().optional(),
  slug: z.string().min(1),
  visibility: z.enum(["visible", "hidden"]),
};

const categorySchema = z.object(categoryBase);

type CategoryNode = z.infer<typeof categorySchema> & { children: CategoryNode[] };

const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() => categorySchema.extend({ children: z.array(categoryNodeSchema).default([]) }));
const categoryTreeSchema = z.array(categoryNodeSchema);

export class ApiAdminCategoriesRepository implements AdminCategoriesRepository {
  readonly source = "api" as const;
  private readonly client: AdminApiClient;

  constructor(fetchImplementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch, baseUrl: string = catalogApiConfig.baseUrl) {
    this.client = new AdminApiClient(fetchImplementation, baseUrl);
  }

  async list(): Promise<AdminProductCategory[]> {
    const payload = await this.send(() => this.client.get<unknown>("/admin/categories"));
    return flatten(parse(categoryTreeSchema, payload));
  }

  async create(input: AdminCategoryInput): Promise<AdminProductCategory> {
    const payload = await this.send(() => this.client.post<unknown>("/admin/categories", toPayload(input)));
    return toCategory(parse(categorySchema, payload));
  }

  async update(id: string, input: AdminCategoryUpdateInput): Promise<AdminProductCategory> {
    const payload = await this.send(() => this.client.put<unknown>(`/admin/categories/${encodeURIComponent(id)}`, toPayload(input)));
    return toCategory(parse(categorySchema, payload));
  }

  async setVisibility(id: string, visibility: AdminCategoryVisibility): Promise<void> {
    await this.send(() => this.client.put<unknown>(`/admin/categories/${encodeURIComponent(id)}/visibility`, { visibility }));
  }

  async delete(id: string): Promise<void> {
    await this.send(() => this.client.delete<unknown>(`/admin/categories/${encodeURIComponent(id)}`));
  }

  private async send<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      if (error instanceof AdminCategoriesApiError) throw error;
      if (error instanceof AdminApiError) throw new AdminCategoriesApiError({ code: error.code, message: error.message, status: error.status });
      throw new AdminCategoriesApiError({ code: "ADMIN_CATEGORIES_ERROR", message: error instanceof Error ? error.message : "The category request failed.", status: 500 });
    }
  }
}

/** `undefined` fields are dropped by JSON (server preserves them on update); `null` fields clear the stored value. */
function toPayload(input: AdminCategoryInput | AdminCategoryUpdateInput): Record<string, unknown> {
  return {
    description: input.description,
    googleShoppingCategory: input.googleShoppingCategory,
    imageUrl: input.imageUrl,
    name: input.name,
    parentId: input.parentId,
    seoDescription: input.seoDescription,
    seoTitle: input.seoTitle,
    slug: input.slug,
    visibility: input.visibility,
  };
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AdminCategoriesApiError({ code: ADMIN_CATEGORIES_ERROR_CODE.INVALID_RESPONSE, message: "The category response was invalid.", status: 502 });
  }
  return result.data;
}

function toCategory({ description, googleShoppingCategory, id, imageUrl, name, parentId, seoDescription, seoTitle, slug, visibility }: z.infer<typeof categorySchema>): AdminProductCategory {
  return {
    id,
    name,
    slug,
    visibility,
    ...(description ? { description } : {}),
    ...(googleShoppingCategory ? { googleShoppingCategory } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(parentId ? { parentId } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(seoTitle ? { seoTitle } : {}),
  };
}

function flatten(nodes: readonly CategoryNode[]): AdminProductCategory[] {
  return nodes.flatMap((node) => [toCategory(node), ...flatten(node.children)]);
}
