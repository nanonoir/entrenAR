import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import type { CheckoutCatalogProduct, CheckoutCatalogVariant } from "../catalog/catalog.mapper";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CheckoutRepository } from "./checkout.repository";
import type { CheckoutCartRecord, TransactionClient } from "./checkout-cart.repository";

export interface ResolvedCheckoutLine {
  availableQuantity: number | null;
  cartItemId: string;
  compareAtPrice?: number;
  lineSubtotal: number;
  product: CheckoutCatalogProduct;
  quantity: number;
  totalWeightGrams: number | null;
  unitPrice: number;
  variant?: CheckoutCatalogVariant;
  weightGrams: number | null;
}

@Injectable()
export class CheckoutLineResolver {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly checkoutRepository: CheckoutRepository,
  ) {}

  async resolveLines(
    transaction: TransactionClient,
    cart: CheckoutCartRecord,
    publicCategoryIds: ReadonlySet<string>,
    lockForCompletion: boolean,
  ): Promise<ResolvedCheckoutLine[]> {
    const lines: ResolvedCheckoutLine[] = [];

    for (const item of cart.items) {
      const product = lockForCompletion
        ? await this.catalogRepository.checkoutProductByIdForUpdate(transaction, item.productId)
        : await this.catalogRepository.checkoutProductById(transaction, item.productId);
      if (!product || product.visibility !== CatalogVisibility.VISIBLE || !product.categoryIds.some((id) => publicCategoryIds.has(id))) {
        throw this.productNotFound();
      }

      const variant = this.variantForItem(product, item.variantId);
      const inventory = await this.checkoutRepository.stockTargetForCheckout(
        transaction,
        product.id,
        variant?.id,
      );
      if (item.variantId && !variant) throw this.variantNotFound();
      if (!inventory) throw variant ? this.variantNotFound() : this.productNotFound();
      if (inventory.stockMode !== StockMode.INFINITE && (inventory.quantity ?? 0) < item.quantity) {
        throw this.outOfStock();
      }

      const unitPrice = variant?.price ?? product.effectivePrice;
      const weightGrams = product.weightGrams ?? null;
      lines.push({
        availableQuantity: inventory.stockMode === StockMode.INFINITE ? null : inventory.quantity ?? 0,
        cartItemId: item.id,
        ...(variant?.compareAtPrice === undefined && product.compareAtPrice === undefined
          ? {}
          : { compareAtPrice: variant?.compareAtPrice ?? product.compareAtPrice }),
        lineSubtotal: roundMoney(unitPrice * item.quantity),
        product,
        quantity: item.quantity,
        totalWeightGrams: weightGrams === null ? null : weightGrams * item.quantity,
        unitPrice,
        ...(variant ? { variant } : {}),
        weightGrams,
      });
    }

    return lines;
  }

  private variantForItem(product: CheckoutCatalogProduct, variantId: string | null): CheckoutCatalogVariant | undefined {
    if (variantId) return product.variants.find((variant) => variant.id === variantId);
    if (product.variants.length === 1) return product.variants[0];
    return product.variants.find((variant) => variant.isDefault);
  }

  private variantNotFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.VARIANT_NOT_FOUND,
      message: "The requested product variant was not found.",
      ok: false,
    });
  }

  private productNotFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.PRODUCT_NOT_FOUND, message: "The requested checkout product was not found.", ok: false });
  }

  private outOfStock(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.OUT_OF_STOCK, message: "Insufficient stock for the requested checkout items.", ok: false });
  }
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
