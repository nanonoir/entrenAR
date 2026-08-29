import { NotFoundException } from "@nestjs/common";

import type { PublicCatalogProduct } from "../catalog/catalog.mapper";
import type { CatalogQueryService } from "../catalog/catalog-query.service";
import type { AdminCatalogProduct } from "../catalog/catalog.mapper";
import type { ProductService } from "../catalog/product.service";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { WishlistItemRecord, WishlistRepository } from "./wishlist.repository";
import { WishlistService } from "./wishlist.service";

const PUBLIC_PRODUCT: PublicCatalogProduct = {
  brand: "EntrenAR",
  categoryName: "Proteínas",
  categorySlug: "proteinas",
  description: "A public product fixture.",
  id: "product-visible",
  imageTone: "green",
  isBestSeller: false,
  isFeatured: false,
  name: "Visible Product",
  price: 49.99,
  shortDescription: "A public product fixture.",
  slug: "visible-product",
  stock: 8,
  subcategorySlugs: [],
  tags: ["fixture"],
  variantProperties: [],
  variants: [],
};

const RELATION: WishlistItemRecord = {
  createdAt: new Date("2026-08-29T00:00:00.000Z"),
  productId: PUBLIC_PRODUCT.id,
};

describe("wishlist.service", () => {
  it("adds a visible product for the authenticated owner", async () => {
    const harness = createHarness();
    harness.productService.get.mockResolvedValue(publicCatalogProduct());
    harness.catalogQueries.publicProduct.mockResolvedValue(PUBLIC_PRODUCT);
    harness.repository.findByUserAndProduct.mockResolvedValue(null);

    await expect(harness.service.add("customer-a", PUBLIC_PRODUCT.id)).resolves.toEqual({ ok: true });

    expect(harness.repository.findByUserAndProduct).toHaveBeenCalledWith("customer-a", PUBLIC_PRODUCT.id);
    expect(harness.repository.create).toHaveBeenCalledWith("customer-a", PUBLIC_PRODUCT.id);
  });

  it("rejects duplicate relations without changing the existing wishlist", async () => {
    const harness = createHarness();
    harness.productService.get.mockResolvedValue(publicCatalogProduct());
    harness.catalogQueries.publicProduct.mockResolvedValue(PUBLIC_PRODUCT);
    harness.repository.findByUserAndProduct.mockResolvedValue(RELATION);

    await expect(harness.service.add("customer-a", PUBLIC_PRODUCT.id)).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.WISHLIST_ITEM_EXISTS,
        ok: false,
      },
      status: 409,
    });
    expect(harness.repository.create).not.toHaveBeenCalled();
  });

  it("converts a composite-unique race into the same duplicate error", async () => {
    const harness = createHarness();
    harness.productService.get.mockResolvedValue(publicCatalogProduct());
    harness.catalogQueries.publicProduct.mockResolvedValue(PUBLIC_PRODUCT);
    harness.repository.findByUserAndProduct.mockResolvedValue(null);
    harness.repository.create.mockRejectedValue({ code: "P2002" });

    await expect(harness.service.add("customer-a", PUBLIC_PRODUCT.id)).rejects.toMatchObject({
      response: { code: ERROR_CODE.WISHLIST_ITEM_EXISTS, ok: false },
      status: 409,
    });
  });

  it("rejects unknown and unavailable products before creating a relation", async () => {
    const harness = createHarness();
    harness.productService.get.mockRejectedValue(new NotFoundException());

    await expect(harness.service.add("customer-a", "missing-product")).rejects.toMatchObject({
      response: { code: ERROR_CODE.PRODUCT_NOT_FOUND, ok: false },
      status: 404,
    });

    harness.productService.get.mockResolvedValue(publicCatalogProduct());
    harness.catalogQueries.publicProduct.mockRejectedValue(new NotFoundException());

    await expect(harness.service.add("customer-a", "hidden-product")).rejects.toMatchObject({
      response: { code: ERROR_CODE.PRODUCT_NOT_FOUND, ok: false },
      status: 404,
    });
    expect(harness.repository.create).not.toHaveBeenCalled();
  });

  it("lists only public products that remain available and maps no relation ownership data", async () => {
    const harness = createHarness();
    const hiddenRelation = { ...RELATION, productId: "hidden-product" };
    const missingRelation = { ...RELATION, productId: "missing-product" };
    harness.repository.listByUser.mockResolvedValue([RELATION, hiddenRelation, missingRelation]);
    harness.productService.get.mockImplementation(async (productId: string) => {
      if (productId === "missing-product") {
        throw new NotFoundException();
      }
      return {
        ...publicCatalogProduct(),
        id: productId,
        publicSlug: productId === "hidden-product" ? "hidden-product" : PUBLIC_PRODUCT.slug,
      };
    });
    harness.catalogQueries.publicProduct.mockImplementation(async (slug: string) => {
      if (slug === "hidden-product") {
        throw new NotFoundException();
      }
      return PUBLIC_PRODUCT;
    });

    await expect(harness.service.list("customer-a")).resolves.toEqual([{
      brand: "EntrenAR",
      categoryName: "Proteínas",
      categorySlug: "proteinas",
      id: "product-visible",
      imageTone: "green",
      isBestSeller: false,
      isFeatured: false,
      name: "Visible Product",
      price: 49.99,
      rating: 0,
      reviews: 0,
      shortDescription: "A public product fixture.",
      slug: "visible-product",
      stock: 8,
      subcategorySlugs: [],
      tags: ["fixture"],
    }]);
    expect(harness.repository.listByUser).toHaveBeenCalledWith("customer-a");
  });

  it("removes only an owned relation and returns a controlled missing-relation error", async () => {
    const harness = createHarness();
    harness.repository.delete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(harness.service.remove("customer-a", PUBLIC_PRODUCT.id)).resolves.toEqual({ ok: true });
    await expect(harness.service.remove("customer-a", "not-in-wishlist")).rejects.toMatchObject({
      response: { code: ERROR_CODE.WISHLIST_ITEM_NOT_FOUND, ok: false },
      status: 404,
    });
    expect(harness.repository.delete).toHaveBeenNthCalledWith(1, "customer-a", PUBLIC_PRODUCT.id);
    expect(harness.repository.delete).toHaveBeenNthCalledWith(2, "customer-a", "not-in-wishlist");
  });
});

function createHarness(): WishlistHarness {
  const repository = {
    create: jest.fn(),
    delete: jest.fn(),
    findByUserAndProduct: jest.fn(),
    listByUser: jest.fn(),
  };
  const catalogQueries = {
    publicProduct: jest.fn(),
  };
  const productService = {
    get: jest.fn(),
  };

  return {
    catalogQueries,
    productService,
    repository,
    service: new WishlistService(
      repository as unknown as WishlistRepository,
      catalogQueries as unknown as CatalogQueryService,
      productService as unknown as ProductService,
    ),
  };
}

function publicCatalogProduct(): AdminCatalogProduct {
  return {
    categoryId: "category-1",
    categoryIds: ["category-1"],
    categoryName: "Proteínas",
    createdAt: "2026-08-29T00:00:00.000Z",
    highlightSections: [],
    id: PUBLIC_PRODUCT.id,
    manualOrder: 1,
    missingLogistics: false,
    name: PUBLIC_PRODUCT.name,
    publicSlug: PUBLIC_PRODUCT.slug,
    salePrice: PUBLIC_PRODUCT.price,
    salesCount: 0,
    shippingRequired: true,
    sku: "FIXTURE-SKU",
    slug: PUBLIC_PRODUCT.slug,
    stock: { quantity: PUBLIC_PRODUCT.stock },
    tags: PUBLIC_PRODUCT.tags,
    updatedAt: "2026-08-29T00:00:00.000Z",
    variantCombinations: [],
    variantProperties: [],
    visibility: "visible",
  };
}

interface WishlistHarness {
  catalogQueries: {
    publicProduct: jest.Mock;
  };
  productService: {
    get: jest.Mock;
  };
  repository: {
    create: jest.Mock;
    delete: jest.Mock;
    findByUserAndProduct: jest.Mock;
    listByUser: jest.Mock;
  };
  service: WishlistService;
}
