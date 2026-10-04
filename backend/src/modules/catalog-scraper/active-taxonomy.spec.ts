import { createActiveTaxonomy, loadActiveTaxonomy, resolveActiveSourceMembership, validateActiveCategoryArtifact } from "./active-taxonomy";
import { loadApprovedTaxonomy } from "./taxonomy";

describe("active catalog taxonomy overlay", () => {
  it("keeps the historical 61-category loader immutable while exposing the 60-category active overlay", async () => {
    const historical = await loadApprovedTaxonomy();
    const active = createActiveTaxonomy(historical);

    expect(historical.categories).toHaveLength(61);
    expect(historical.mappings).toHaveLength(61);
    expect(active.categories).toHaveLength(60);
    expect(active.categories.some(({ slug }) => slug === "shakers-y-botellas")).toBe(false);
    expect((await loadActiveTaxonomy()).categories).toEqual(active.categories);
  });

  it("maps both source shaker categories to the root without losing source listing URLs", async () => {
    const historical = await loadApprovedTaxonomy();
    const active = createActiveTaxonomy(historical);
    const oldSources = ["SHAKER", "SHAKERS Y BOTELLAS"];
    const historicalUrls = new Map(historical.mappings.map((mapping) => [mapping.sourceCategory, mapping.sourceUrl]));
    const activeMappings = active.mappings.filter((mapping) => oldSources.includes(mapping.sourceCategory));

    expect(activeMappings.map(({ sourceCategory }) => sourceCategory)).toEqual(oldSources);
    expect(activeMappings.map(({ normalizedSlug }) => normalizedSlug)).toEqual(["shakers", "shakers"]);
    for (const mapping of activeMappings) expect(mapping.sourceUrl).toBe(historicalUrls.get(mapping.sourceCategory));

    const membership = resolveActiveSourceMembership(oldSources, active);
    expect(membership.primarySlug).toBe("shakers");
    expect(membership.categorySlugs).toEqual(["shakers"]);
    expect(membership.categorySlugs).not.toContain("shakers-y-botellas");
  });

  it("rejects a historical category array if it is supplied as an editable active artifact", async () => {
    const historical = await loadApprovedTaxonomy();
    expect(() => validateActiveCategoryArtifact(historical.categories)).toThrow("60-category active overlay");
  });

  it("permits only the explicitly declared shaker many-to-one mapping", async () => {
    const historical = await loadApprovedTaxonomy();
    const unapproved = {
      ...historical,
      mappings: historical.mappings.map((mapping) => mapping.sourceCategory === "MARKET"
        ? { ...mapping, normalizedSlug: "shakers" }
        : mapping),
    };
    expect(() => createActiveTaxonomy(unapproved)).toThrow("Unapproved active many-to-one category mapping");
  });
});
