import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { CatalogVisibility, Role, StockMode } from "../src/generated/prisma/enums";
import { AuthService } from "../src/modules/auth/auth.service";
import { PUBLIC_INFINITE_STOCK } from "../src/modules/inventory/inventory.mapper";

interface ProductResponse {
  id: string;
  name: string;
  price?: number;
  publicSlug: string;
  salePrice?: number;
  slug: string;
  stock?: number;
}

interface ProductPageResponse {
  items: ProductResponse[];
  limit: number;
  page: number;
  total: number;
}

interface CategoryResponse {
  children: CategoryResponse[];
  id: string;
  slug: string;
}

describe("catalog administration and public API (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;
  let baseUrl: string;
  let categoryId: string;
  let categorySlug: string;
  let customerToken: string;
  let publicSlug: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const prisma = moduleFixture.get(PrismaService);
    const suffix = randomUUID();
    const password = "catalog_api_e2e_password";
    const adminEmail = `catalog-admin-${suffix}@entrenar.test`;
    const customerEmail = `catalog-customer-${suffix}@entrenar.test`;

    await prisma.user.createMany({
      data: [
        { email: adminEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.ADMIN },
        { email: customerEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER },
      ],
    });
    const visibleCategory = await prisma.category.create({
      data: { name: "Catalog API visible", slug: `catalog-api-visible-${suffix}`, sortOrder: 1 },
    });
    const hiddenParent = await prisma.category.create({
      data: { name: "Catalog API hidden", slug: `catalog-api-hidden-${suffix}`, sortOrder: 2, visibility: CatalogVisibility.HIDDEN },
    });
    await prisma.category.create({
      data: { name: "Catalog API hidden child", parentId: hiddenParent.id, slug: `catalog-api-hidden-child-${suffix}`, sortOrder: 1 },
    });
    publicSlug = `catalog-api-public-${suffix}`;
    const publicProduct = await prisma.product.create({
      data: {
        name: "Public API product",
        publicSlug,
        quantity: null,
        salePrice: "55.50",
        sku: `CATALOG-API-${suffix}`,
        slug: `catalog-api-product-${suffix}`,
        stockMode: StockMode.INFINITE,
      },
    });
    await prisma.productCategory.create({ data: { categoryId: visibleCategory.id, productId: publicProduct.id } });
    categoryId = visibleCategory.id;
    categorySlug = visibleCategory.slug;
    const authService = moduleFixture.get(AuthService);
    adminToken = (await authService.login(adminEmail, password)).accessToken;
    customerToken = (await authService.login(customerEmail, password)).accessToken;
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(app, testConfig());
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("enforces ADMIN boundaries without mutating catalog state", async () => {
    const body = productInput(categoryId, "boundary");
    const unauthenticated = await request("/api/v1/admin/products", { body, method: "POST" });
    expect(unauthenticated.status).toBe(401);
    await expectJson(unauthenticated, { code: "UNAUTHORIZED", ok: false });

    const customer = await request("/api/v1/admin/products", { body, method: "POST", token: customerToken });
    expect(customer.status).toBe(403);
    await expectJson(customer, { code: "FORBIDDEN", ok: false });

    const page = await request("/api/v1/admin/products?search=boundary", { token: adminToken });
    expect((await json<ProductPageResponse>(page)).total).toBe(0);
  });

  it("supports validated admin product CRUD, price updates, and independent duplication", async () => {
    const body = productInput(categoryId, "lifecycle");
    const createdResponse = await request("/api/v1/admin/products", { body, method: "POST", token: adminToken });
    expect(createdResponse.status).toBe(201);
    const created = await json<ProductResponse>(createdResponse);
    expect(created).toEqual(expect.objectContaining({ publicSlug: body.publicSlug, salePrice: body.salePrice, slug: body.slug }));
    expect(Number.isFinite(created.salePrice!)).toBe(true);

    const conflictResponse = await request("/api/v1/admin/products", { body, method: "POST", token: adminToken });
    expect(conflictResponse.status).toBe(409);
    await expectJson(conflictResponse, { code: "SLUG_CONFLICT", ok: false });

    const updatedBody = { ...body, name: "Catalog lifecycle updated" };
    const updatedResponse = await request(`/api/v1/admin/products/${created.id}`, { body: updatedBody, method: "PUT", token: adminToken });
    expect(updatedResponse.status).toBe(200);
    await expectJson(updatedResponse, { id: created.id, name: updatedBody.name });

    const pricedResponse = await request(`/api/v1/admin/products/${created.id}/price`, {
      body: { salePrice: 73.25 },
      method: "PUT",
      token: adminToken,
    });
    expect(pricedResponse.status).toBe(200);
    await expectJson(pricedResponse, { salePrice: 73.25 });

    const duplicateResponse = await request(`/api/v1/admin/products/${created.id}/duplicate`, { method: "POST", token: adminToken });
    expect(duplicateResponse.status).toBe(201);
    const duplicate = await json<ProductResponse>(duplicateResponse);
    expect(duplicate.id).not.toBe(created.id);
    expect(duplicate.slug).not.toBe(created.slug);
    expect(duplicate.publicSlug).not.toBe(created.publicSlug);

    const deletedResponse = await request(`/api/v1/admin/products/${created.id}`, { method: "DELETE", token: adminToken });
    expect(deletedResponse.status).toBe(204);
    const missingResponse = await request(`/api/v1/admin/products/${created.id}`, { token: adminToken });
    expect(missingResponse.status).toBe(404);
    await expectJson(missingResponse, { code: "NOT_FOUND", ok: false });
  });

  it("supports category organization commands and safe settings responses", async () => {
    const suffix = randomUUID();
    const createdResponse = await request("/api/v1/admin/categories", {
      body: { name: `Category command ${suffix}`, slug: `category-command-${suffix}`, visibility: "visible" },
      method: "POST",
      token: adminToken,
    });
    expect(createdResponse.status).toBe(201);
    const created = await json<CategoryResponse>(createdResponse);

    const visibilityResponse = await request(`/api/v1/admin/categories/${created.id}/visibility`, {
      body: { visibility: "hidden" },
      method: "PUT",
      token: adminToken,
    });
    expect(visibilityResponse.status).toBe(200);
    await expectJson(visibilityResponse, { ok: true });

    const categoriesResponse = await request("/api/v1/admin/categories", { token: adminToken });
    const categoryIds = flattenCategoryIds(await json<CategoryResponse[]>(categoriesResponse));
    const orderResponse = await request("/api/v1/admin/categories/order", {
      body: { categoryIds },
      method: "PUT",
      token: adminToken,
    });
    expect(orderResponse.status).toBe(200);

    const settingsResponse = await request("/api/v1/admin/catalog/settings", {
      body: { showOutOfStockAtEnd: false },
      method: "PUT",
      token: adminToken,
    });
    expect(settingsResponse.status).toBe(200);
    await expectJson(settingsResponse, { persistOrder: true, showOutOfStockAtEnd: false });

    const protectedDeleteResponse = await request(`/api/v1/admin/categories/${categoryId}`, { method: "DELETE", token: adminToken });
    expect(protectedDeleteResponse.status).toBe(409);
    await expectJson(protectedDeleteResponse, { code: "CATEGORY_IN_USE", ok: false });

    const deletedResponse = await request(`/api/v1/admin/categories/${created.id}`, { method: "DELETE", token: adminToken });
    expect(deletedResponse.status).toBe(204);
  });

  it("returns public DTOs without authentication and preserves public slug compatibility", async () => {
    const categoriesResponse = await request("/api/v1/categories");
    expect(categoriesResponse.status).toBe(200);
    const categories = await json<Array<{ slug: string }>>(categoriesResponse);
    expect(categories.some((category) => category.slug.includes("hidden-child"))).toBe(false);

    const listResponse = await request(`/api/v1/products?page=1&limit=1&categorySlug=${categorySlug}&sort=price-asc`);
    expect(listResponse.status).toBe(200);
    const list = await json<ProductPageResponse>(listResponse);
    expect(list).toEqual(expect.objectContaining({ limit: 1, page: 1, total: expect.any(Number) }));

    const detailResponse = await request(`/api/v1/products/${publicSlug}`);
    expect(detailResponse.status).toBe(200);
    const detail = await json<ProductResponse>(detailResponse);
    expect(detail).toEqual(expect.objectContaining({ price: 55.5, slug: publicSlug, stock: PUBLIC_INFINITE_STOCK }));
    expect(detail).not.toHaveProperty("publicSlug");
    expect(Number.isFinite(detail.price!)).toBe(true);

    const missingResponse = await request(`/api/v1/products/missing-${randomUUID()}`);
    expect(missingResponse.status).toBe(404);
    await expectJson(missingResponse, { code: "NOT_FOUND", ok: false });

    const invalidQueryResponse = await request("/api/v1/products?page=0&sort=unsupported");
    expect(invalidQueryResponse.status).toBe(400);
    await expectJson(invalidQueryResponse, { code: "VALIDATION_ERROR", ok: false });
  });

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      ...(options.body ? { body: JSON.stringify(options.body), headers: { "content-type": "application/json" } } : {}),
      ...(options.token ? { headers: { authorization: `Bearer ${options.token}`, ...(options.body ? { "content-type": "application/json" } : {}) } } : {}),
      method: options.method ?? "GET",
    });
  }
});

interface RequestOptions {
  body?: object;
  method?: "DELETE" | "GET" | "POST" | "PUT";
  token?: string;
}

function productInput(categoryId: string, label: string) {
  const suffix = randomUUID();
  return {
    categoryIds: [categoryId],
    description: "A complete catalog API lifecycle fixture product.",
    name: `Catalog ${label} ${suffix}`,
    publicSlug: `catalog-${label}-public-${suffix}`,
    salePrice: 49.99,
    sku: `CATALOG-${label}-${suffix}`,
    slug: `catalog-${label}-${suffix}`,
    stockMode: "limited",
    stockQuantity: 5,
    visibility: "visible",
  };
}

function flattenCategoryIds(categories: readonly CategoryResponse[]): string[] {
  return categories.flatMap((category) => [category.id, ...flattenCategoryIds(category.children)]);
}

function testConfig() {
  return {
    bodyLimitBytes: 104_857,
    corsOrigin: "http://localhost:3000",
    databaseUrl: process.env["DATABASE_URL"] ?? "",
    jwtAccessSecret: process.env["JWT_ACCESS_SECRET"] ?? "",
    jwtAccessTtlSeconds: 900,
    jwtRefreshSecret: process.env["JWT_REFRESH_SECRET"] ?? "",
    jwtRefreshTtlSeconds: 2_592_000,
    nodeEnv: "test" as const,
    port: 3001,
    throttleLimit: 100,
    throttleTtlSeconds: 60,
  };
}

async function expectJson(response: Response, expected: object): Promise<void> {
  await expect(json<object>(response)).resolves.toEqual(expect.objectContaining(expected));
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
