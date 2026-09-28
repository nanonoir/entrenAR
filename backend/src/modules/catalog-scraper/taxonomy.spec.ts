import { CatalogTaxonomySyncService, validateCategoryArtifact } from "./taxonomy";

describe("category artifact", () => {
  it("sorts deterministically and rejects cycles", () => {
    expect(validateCategoryArtifact([
      { slug: "child", name: "Child", parentSlug: "root", visibility: "visible", sortOrder: 2 },
      { slug: "root", name: "Root", visibility: "visible", sortOrder: 1 },
    ]).map((item) => item.slug)).toEqual(["root", "child"]);
    expect(() => validateCategoryArtifact([
      { slug: "a", name: "A", parentSlug: "b", visibility: "visible", sortOrder: 1 },
      { slug: "b", name: "B", parentSlug: "a", visibility: "visible", sortOrder: 2 },
    ])).toThrow("Category cycle");
  });

  it("syncs hierarchy idempotently and preserves unrelated categories", async () => {
    const updates: unknown[] = [];
    const categories = [{ id: "root-id", name: "Old root", slug: "root", parentId: null, sortOrder: 9, visibility: "VISIBLE" as const }, { id: "unrelated", name: "Unrelated", slug: "unrelated", parentId: null, sortOrder: 50, visibility: "VISIBLE" as const }];
    const transaction = { category: { update: async (input: unknown) => { updates.push(input); return input; } } };
    const repository = {
      transaction: async <T>(callback: (value: typeof transaction) => Promise<T>) => callback(transaction),
      allCategories: async () => categories,
      createCategory: async (_tx: typeof transaction, data: { slug: string; name: string; parentId?: string; sortOrder: number; visibility: unknown }) => ({ id: `${data.slug}-id`, ...data, parentId: data.parentId ?? null }),
      updateCategory: async (_tx: typeof transaction, id: string, data: unknown) => { updates.push({ id, data }); return { id, ...(data as object) }; },
    };
    const service = new CatalogTaxonomySyncService(repository as never);
    await expect(service.sync([{ slug: "root", name: "Root", visibility: "visible", sortOrder: 1 }, { slug: "child", name: "Child", parentSlug: "root", visibility: "visible", sortOrder: 2 }])).resolves.toMatchObject({ created: 1, updated: 1 });
    expect(updates).toHaveLength(2);
    expect(categories.some((category) => category.slug === "unrelated")).toBe(true);
  });
});
