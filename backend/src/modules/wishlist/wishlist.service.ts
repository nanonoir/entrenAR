import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CatalogQueryService } from "../catalog/catalog-query.service";
import { ProductService } from "../catalog/product.service";
import type { PublicCatalogProduct } from "../catalog/catalog.mapper";
import { toWishlistProduct, type WishlistProductSummary } from "./wishlist.mapper";
import { WishlistRepository } from "./wishlist.repository";

export interface WishlistSuccess {
  ok: true;
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly catalogQueries: CatalogQueryService,
    private readonly productService: ProductService,
  ) {}

  async list(userId: string): Promise<WishlistProductSummary[]> {
    const relations = await this.wishlistRepository.listByUser(userId);
    const products = await Promise.all(relations.map((relation) => this.publicProductById(relation.productId)));

    return products
      .filter((product): product is PublicCatalogProduct => product !== null)
      .map(toWishlistProduct);
  }

  async add(userId: string, productId: string): Promise<WishlistSuccess> {
    if (!await this.publicProductById(productId)) {
      throw this.productNotFound();
    }

    if (await this.wishlistRepository.findByUserAndProduct(userId, productId)) {
      throw this.itemExists();
    }

    try {
      await this.wishlistRepository.create(userId, productId);
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw this.itemExists();
      }

      throw error;
    }

    return { ok: true };
  }

  async remove(userId: string, productId: string): Promise<WishlistSuccess> {
    const deleted = await this.wishlistRepository.delete(userId, productId);

    if (!deleted) {
      throw this.itemNotFound();
    }

    return { ok: true };
  }

  private async publicProductById(productId: string): Promise<PublicCatalogProduct | null> {
    try {
      const product = await this.productService.get(productId);

      return await this.catalogQueries.publicProduct(product.publicSlug);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }

      throw error;
    }
  }

  private productNotFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.PRODUCT_NOT_FOUND,
      message: "The requested public product was not found.",
      ok: false,
    });
  }

  private itemExists(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.WISHLIST_ITEM_EXISTS,
      message: "The product is already in the wishlist.",
      ok: false,
    });
  }

  private itemNotFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.WISHLIST_ITEM_NOT_FOUND,
      message: "The product is not in the wishlist.",
      ok: false,
    });
  }
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
