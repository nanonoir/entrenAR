import { randomUUID } from "node:crypto";

import { HttpException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility } from "../src/generated/prisma/enums";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { CatalogRepository } from "../src/modules/catalog/catalog.repository";
import { CategoryService } from "../src/modules/catalog/category.service";
import { ProductService } from "../src/modules/catalog/product.service";
import { categoryCreateSchema, categoryUpdateSchema, productCreateSchema } from "../src/modules/catalog/catalog.schemas";

const databaseUrl = process.env["DATABASE_URL"];

describe("catalog domain integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const repository = new CatalogRepository(prisma as unknown as PrismaService);
  const categories = new CategoryService(repository);
  const products = new ProductService(repository);

  beforeAll(() => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for catalog domain integration tests.");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("prevents category cycles and deletion of a referenced descendant", async () => {
    const root = await categories.create(categoryInput("root"));
    const child = await categories.create(categoryInput("child", root.id));
    await expectCode(categories.update(categoryUpdateSchema.parse(categoryInput("root", child.id, root.id))), "CATEGORY_CYCLE");

    await products.create(productInput(root.id, { sku: `PRODUCT-${randomUUID()}` }));
    await expectCode(categories.delete(root.id), "CATEGORY_IN_USE");
    await expect(prisma.category.findUnique({ where: { id: child.id } })).resolves.toEqual(expect.objectContaining({ parentId: root.id }));
  });

  it("hides a category subtree and does not reveal descendants when its parent is shown", async () => {
    const root = await categories.create(categoryInput("visibility-root"));
    const child = await categories.create(categoryInput("visibility-child", root.id));

    await categories.setVisibility(root.id, "hidden");
    await categories.setVisibility(root.id, "visible");

    await expect(prisma.category.findUnique({ where: { id: root.id } })).resolves.toEqual(expect.objectContaining({ visibility: CatalogVisibility.VISIBLE }));
    await expect(prisma.category.findUnique({ where: { id: child.id } })).resolves.toEqual(expect.objectContaining({ visibility: CatalogVisibility.HIDDEN }));
  });

  it("rejects duplicate slug, public slug, and SKU without partial product writes", async () => {
    const category = await categories.create(categoryInput("identity"));
    const suffix = randomUUID();
    await products.create(productInput(category.id, { publicSlug: `public-${suffix}`, sku: `SKU-${suffix}`, slug: `slug-${suffix}` }));
    const count = await prisma.product.count();

    await expectCode(products.create(productInput(category.id, { sku: `NEW-${suffix}`, slug: `slug-${suffix}` })), "SLUG_CONFLICT");
    await expectCode(products.create(productInput(category.id, { publicSlug: `public-${suffix}`, sku: `NEW2-${suffix}` })), "SLUG_CONFLICT");
    await expectCode(products.create(productInput(category.id, { sku: `SKU-${suffix}` })), "SKU_CONFLICT");
    await expect(prisma.product.count()).resolves.toBe(count);
  });

  it("requires every Cartesian combination and creates a default variant when no axes exist", async () => {
    const category = await categories.create(categoryInput("variants"));
    const count = await prisma.product.count();
    await expectCode(products.create(productInput(category.id, {
      variantCombinations: [
        { name: "Black / S", sku: `VAR-${randomUUID()}`, stock: 1 },
        { name: "Black / M", sku: `VAR-${randomUUID()}`, stock: 1 },
        { name: "Blue / S", sku: `VAR-${randomUUID()}`, stock: 1 },
      ],
      variantProperties: [
        { name: "Color", values: ["Black", "Blue"] },
        { name: "Size", values: ["S", "M"] },
      ],
    })), "VALIDATION_ERROR");
    await expect(prisma.product.count()).resolves.toBe(count);

    const created = await products.create(productInput(category.id));
    expect(created.variantCombinations).toEqual([expect.objectContaining({ name: "Default", stock: 8 })]);
  });

  it("inherits the product price for variants without overrides", async () => {
    const category = await categories.create(categoryInput("inheritance"));
    const product = await products.create(productInput(category.id, {
      salePrice: 55.5,
      variantCombinations: [
        { name: "Black", sku: `VAR-${randomUUID()}`, stock: 2 },
      ],
      variantProperties: [{ name: "Color", values: ["Black"] }],
    }));

    expect(product.variantCombinations[0]).toEqual(expect.objectContaining({ price: 55.5 }));
  });

  it("duplicates products with independent variants, inventory, zero sales, and collision-safe identities", async () => {
    const category = await categories.create(categoryInput("duplicate"));
    const source = await products.create(productInput(category.id, {
      variantCombinations: [
        { name: "Black", sku: `VAR-${randomUUID()}`, stock: 4 },
      ],
      variantProperties: [{ name: "Color", values: ["Black"] }],
    }));
    const duplicate = await products.duplicate(source.id);
    const sourceVariant = source.variantCombinations[0];
    const duplicateVariant = duplicate.variantCombinations[0];
    if (!sourceVariant || !duplicateVariant) throw new Error("Expected source and duplicate variants.");

    expect(duplicate).toEqual(expect.objectContaining({
      id: expect.not.stringMatching(new RegExp(`^${source.id}$`)),
      manualOrder: expect.any(Number),
      publicSlug: expect.not.stringMatching(new RegExp(`^${source.publicSlug}$`)),
      salesCount: 0,
      sku: expect.not.stringMatching(new RegExp(`^${source.sku}$`)),
      slug: expect.not.stringMatching(new RegExp(`^${source.slug}$`)),
    }));
    expect(duplicateVariant.id).not.toBe(sourceVariant.id);
    expect(duplicateVariant.sku).not.toBe(sourceVariant.sku);

    await prisma.productVariant.update({ data: { quantity: 1 }, where: { id: duplicateVariant.id } });
    await expect(prisma.productVariant.findUnique({ where: { id: sourceVariant.id } })).resolves.toEqual(expect.objectContaining({ quantity: 4 }));
    await expectCode(products.duplicate(`missing-${randomUUID()}`), "NOT_FOUND");
  });
});

function categoryInput(name: string, parentId?: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    name: `${name}-${randomUUID().slice(0, 8)}`,
    ...(parentId ? { parentId } : {}),
    visibility: "visible" as const,
  };
}

function productInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID();
  return productCreateSchema.parse({
    categoryIds: [categoryId],
    description: "A persistent catalog product test fixture.",
    name: `Product ${suffix}`,
    salePrice: 49.99,
    sku: `SKU-${suffix}`,
    slug: `slug-${suffix}`,
    stockMode: "limited",
    stockQuantity: 8,
    visibility: "visible",
    ...overrides,
  });
}

async function expectCode(operation: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(errorCode(error)).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected ${expectedCode}.`);
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();
  return typeof response === "object" && response !== null && "code" in response && typeof response.code === "string"
    ? response.code
    : undefined;
}
