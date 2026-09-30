import { categoryPageUrl, collectCategoryMemberships, extractProductIds } from "./category-memberships";

describe("approved functional category listing helpers", () => {
  it("builds pages from the exact approved route and rejects unknown hosts", () => {
    expect(categoryPageUrl("https://www.entreno.com.ar/suplementos/proteinas/", 2)).toBe("https://www.entreno.com.ar/suplementos/proteinas/page/2/?results_only=true&limit=100&theme=toluca");
    expect(() => categoryPageUrl("https://evil.example/proteinas/", 1)).toThrow("Unapproved");
  });

  it("extracts only numeric product IDs from listing markup", () => {
    expect(extractProductIds('<div class="js-item-product" data-product-id="341936320"></div><div data-product-id="bad"></div><div data-product-id="341936320"></div><div data-product-id="118"></div>')).toEqual(["341936320", "118"]);
  });

  it("follows all full pages before deciding pagination has ended", async () => {
    const requested: string[] = [];
    const fetcher = { request: async (url: string) => {
      requested.push(url);
      const page = new URL(url).pathname.includes("/page/2/");
      const html = page ? '<div data-product-id="900"></div>' : Array.from({ length: 100 }, (_, index) => `<div data-product-id="${index + 1}"></div>`).join("");
      return { status: 200, headers: new Headers(), text: async () => JSON.stringify({ html }), arrayBuffer: async () => new ArrayBuffer(0) };
    } };
    const memberships = await collectCategoryMemberships([{ sourceCategory: "PROTEINAS", sourceUrl: "https://www.entreno.com.ar/suplementos/proteinas/", normalizedSlug: "proteinas", parentSlug: "suplementos", action: "keep" }], fetcher);
    expect(requested).toHaveLength(2);
    expect(memberships.get("900")).toEqual(["PROTEINAS"]);
  });
});
