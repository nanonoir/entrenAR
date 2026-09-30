import { CatalogTaxonomySyncService, loadApprovedTaxonomy, resolveSourceMembership, validateCategoryArtifact, validateSourceCategoryMap } from "./taxonomy";

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
    expect(() => validateCategoryArtifact([
      { slug: "root", name: "Root", visibility: "visible", sortOrder: 1 },
      { slug: "root", name: "Duplicate", visibility: "visible", sortOrder: 2 },
    ])).toThrow("Duplicate category slug");
  });

  it("loads the tracked 61-category taxonomy and exact approved source identities", async () => {
    const { categories, mappings } = await loadApprovedTaxonomy();
    expect(categories).toHaveLength(61);
    expect(mappings).toHaveLength(61);
    expect(mappings.find((mapping) => mapping.sourceCategory === "POLVOS & MEZCLAS")).toMatchObject({ sourceUrl: "https://www.entreno.com.ar/market/panqueques-mezclas/", normalizedSlug: "polvos-mezclas", action: "map" });
    expect(mappings.some((mapping) => mapping.sourceCategory === "MARCAS")).toBe(false);
    expect(resolveSourceMembership(["PROTEINAS"], categories, mappings).categorySlugs).toContain("suplementos");
    expect(resolveSourceMembership(["PROTEINAS", "WHEY PROTEIN"], categories, mappings).categorySlugs).toEqual(expect.arrayContaining(["suplementos", "proteinas", "whey-protein"]));
    expect(() => resolveSourceMembership(["UNAPPROVED"], categories, mappings)).toThrow("Unknown category drift");
  });

  it("rejects duplicate mappings and mappings to absent approved categories", async () => {
    const { categories, mappings } = await loadApprovedTaxonomy();
    expect(() => validateSourceCategoryMap([mappings[0]!, mappings[0]!, ...mappings.slice(1)], categories)).toThrow("Duplicate source category mapping");
    expect(() => validateSourceCategoryMap(mappings.slice(1), categories)).toThrow("must contain 61 categories");
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
