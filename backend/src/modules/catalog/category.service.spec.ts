import { CatalogVisibility } from "../../generated/prisma/enums";
import { CategoryService } from "./category.service";
import { CatalogRepository } from "./catalog.repository";

describe("CategoryService.update", () => {
  const current = { id: "cat-1", parentId: "cat-root", slug: "current" };
  const root = { id: "cat-root", parentId: null, slug: "root" };

  function createService() {
    const updateCategory = jest.fn(async (_transaction: unknown, _id: string, data: unknown) => ({ id: "cat-1", ...(data as object) }));
    const setCategoryVisibility = jest.fn(async () => undefined);
    const repository = {
      allCategories: jest.fn(async () => [root, current, { id: "cat-child", parentId: "cat-1", slug: "child" }]),
      categoryById: jest.fn(async (_transaction: unknown, id: string) => [root, current].find((category) => category.id === id) ?? null),
      categoryBySlug: jest.fn(async () => null),
      setCategoryVisibility,
      transaction: jest.fn(async (run: (transaction: unknown) => unknown) => run({})),
      updateCategory,
    } as unknown as CatalogRepository;
    return { service: new CategoryService(repository), setCategoryVisibility, updateCategory };
  }

  it("preserves omitted optional fields and the parent (undefined is never sent as null)", async () => {
    const { service, updateCategory } = createService();

    await service.update({ id: "cat-1", name: "Renamed", visibility: "visible" });

    const data = updateCategory.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(data).toEqual({ name: "Renamed", slug: "current", visibility: CatalogVisibility.VISIBLE });
    for (const key of ["description", "googleShoppingCategory", "imageUrl", "parentId", "seoDescription", "seoTitle"]) {
      expect(data[key]).toBeUndefined();
    }
  });

  it("clears optional fields and moves to the root only on explicit null", async () => {
    const { service, updateCategory } = createService();

    await service.update({
      description: null,
      googleShoppingCategory: null,
      id: "cat-1",
      imageUrl: null,
      name: "Renamed",
      parentId: null,
      seoDescription: null,
      seoTitle: null,
      visibility: "visible",
    });

    expect(updateCategory).toHaveBeenCalledWith({}, "cat-1", {
      description: null,
      googleShoppingCategory: null,
      imageUrl: null,
      name: "Renamed",
      parentId: null,
      seoDescription: null,
      seoTitle: null,
      slug: "current",
      visibility: CatalogVisibility.VISIBLE,
    });
  });

  it("still rejects cycles when a new parent is provided", async () => {
    const { service } = createService();

    await expect(service.update({ id: "cat-root", name: "Root", parentId: "cat-1", visibility: "visible" })).rejects.toBeDefined();
  });

  it("keeps provided values and cascades hidden visibility to descendants", async () => {
    const { service, setCategoryVisibility, updateCategory } = createService();

    await service.update({ description: "Texto", id: "cat-1", name: "Kept", parentId: "cat-root", slug: "current", visibility: "hidden" });

    expect(updateCategory).toHaveBeenCalledWith({}, "cat-1", expect.objectContaining({ description: "Texto", parentId: "cat-root", visibility: CatalogVisibility.HIDDEN }));
    expect(setCategoryVisibility).toHaveBeenCalledWith({}, ["cat-1", "cat-child"], CatalogVisibility.HIDDEN);
  });
});
