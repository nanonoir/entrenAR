import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import {
  toCheckoutQuoteResponse,
  type CheckoutQuoteItemProjection,
  type CheckoutQuoteProjection,
} from "./checkout.mapper";
import {
  CHECKOUT_CURRENCY,
  CHECKOUT_QUOTE_TTL_SECONDS,
} from "./checkout.constants";
import {
  type CheckoutCompleteRequest,
  type CheckoutCustomerInput,
  type CheckoutQuoteRequest,
} from "./checkout.schemas";
import {
  CheckoutRepository,
  type CheckoutCartRecord,
  type CheckoutOwner,
  type TransactionClient,
} from "./checkout.repository";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CommerceRepository } from "../commerce/commerce.repository";
import {
  CheckoutDeliveryRules,
  type DeliveryCalculation,
} from "./checkout-delivery.rules";
import {
  CheckoutDiscountRules,
  type CouponCalculation,
} from "./checkout-discount.rules";
import { CheckoutPaymentRules, type SelectedPayment } from "./checkout-payment.rules";
import { CheckoutLineResolver, roundMoney, type ResolvedCheckoutLine } from "./checkout-line-resolver";

export type { DeliveryCalculation } from "./checkout-delivery.rules";
export type { CouponCalculation } from "./checkout-discount.rules";
export type { SelectedPayment } from "./checkout-payment.rules";

export interface CheckoutActorContext {
  role?: Role;
  userId?: string;
}

export interface CheckoutQuoteResult extends CheckoutQuoteProjection {
  sessionToken?: string;
}

export interface CheckoutCalculationInput {
  address?: CheckoutQuoteRequest["address"];
  addressId?: string;
  couponCode?: string;
  customer?: CheckoutCustomerInput;
  deliveryType?: CheckoutQuoteRequest["deliveryType"];
  items: CheckoutQuoteRequest["items"];
  paymentMethodId?: CheckoutCompleteRequest["paymentMethodId"];
  paymentOptionId?: string;
  pickupPointId?: string;
  postalCode?: string;
  province?: string;
  quoteId?: string;
  sessionToken?: string;
  shippingMethodId?: string;
  shippingProviderId?: string;
}

export interface QuoteCalculation extends CheckoutQuoteProjection {
  baseShipping: number;
  couponCalculation?: CouponCalculation;
  delivery: DeliveryCalculation;
  lines: ResolvedCheckoutLine[];
  selectedPayment?: SelectedPayment;
  shippingDiscount: number;
}

@Injectable()
export class CheckoutQuoteService {
  private readonly lineResolver: CheckoutLineResolver;
  private readonly deliveryRules: CheckoutDeliveryRules;
  private readonly discountRules: CheckoutDiscountRules;
  private readonly paymentRules: CheckoutPaymentRules;

  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly catalogRepository: CatalogRepository,
    commerceRepository: CommerceRepository,
    @Optional() lineResolver?: CheckoutLineResolver,
    @Optional() deliveryRules?: CheckoutDeliveryRules,
    @Optional() paymentRules?: CheckoutPaymentRules,
    @Optional() discountRules?: CheckoutDiscountRules,
  ) {
    this.lineResolver = lineResolver ?? new CheckoutLineResolver(catalogRepository, checkoutRepository);
    this.deliveryRules = deliveryRules ?? new CheckoutDeliveryRules(commerceRepository);
    this.discountRules = discountRules ?? new CheckoutDiscountRules(checkoutRepository, commerceRepository);
    this.paymentRules = paymentRules ?? new CheckoutPaymentRules(commerceRepository);
  }

  async quote(
    input: CheckoutQuoteRequest,
    actor?: CheckoutActorContext,
  ): Promise<CheckoutQuoteResult> {
    this.assertActor(actor);

    return this.checkoutRepository.transaction(async (transaction) => {
      const resolution = await this.resolveCart(transaction, input, actor);
      if (!resolution.merged) await this.assertItemReferences(transaction, input.items);
      const cart = resolution.merged
        ? resolution.cart
        : await this.checkoutRepository.replaceCartItems(transaction, resolution.cart.id, input.items);
      const calculation = await this.calculateQuote(transaction, cart, input, actor, new Date(), false);
      const expiresAt = new Date(Date.now() + CHECKOUT_QUOTE_TTL_SECONDS * 1_000);
      const quoteId = createQuoteId();
      const quote = toCheckoutQuoteResponse({
        ...this.publicQuote(calculation),
        expiresAt: expiresAt.toISOString(),
        quoteId,
        ...(resolution.sessionToken ? { sessionToken: resolution.sessionToken } : {}),
      });

      await this.checkoutRepository.updateSessionSnapshot(
        transaction,
        resolution.session.id,
        this.quoteSnapshot(calculation, quoteId, expiresAt),
        new Date(),
      );

      return quote;
    });
  }

  async getQuote(input: CheckoutQuoteRequest, actor?: CheckoutActorContext): Promise<CheckoutQuoteResult> {
    return this.quote(input, actor);
  }

  async calculateQuote(
    transaction: TransactionClient,
    cart: CheckoutCartRecord,
    input: CheckoutCalculationInput,
    actor: CheckoutActorContext | undefined,
    now: Date,
    requireCompletion: boolean,
  ): Promise<QuoteCalculation> {
    const publicCategoryIds = await this.catalogRepository.publicCheckoutCategoryIds(transaction);
    const lines = await this.lineResolver.resolveLines(transaction, cart, publicCategoryIds, requireCompletion);
    const subtotal = roundMoney(lines.reduce((total, line) => total + line.lineSubtotal, 0));
    const { paymentMethods, selectedPayment } = await this.paymentRules.calculate(transaction, input, requireCompletion);
    const deliveryCalculation = await this.deliveryRules.calculate(transaction, input, lines, subtotal, requireCompletion);
    const { delivery, pickupPoints, shippingOptions } = deliveryCalculation;
    const discountCalculation = await this.discountRules.calculate(
      transaction,
      {
        couponCode: input.couponCode,
        customerEmail: input.customer?.email,
        province: input.province ?? input.address?.province,
        shippingMethodId: delivery.shippingOption?.id,
      },
      lines,
      subtotal,
      delivery.baseCost,
      shippingOptions,
      actor?.userId,
      now,
      requireCompletion,
    );
    const couponCalculation = discountCalculation.couponCalculation;
    const shippingDiscount = discountCalculation.shippingDiscount;
    const shipping = roundMoney(Math.max(0, delivery.baseCost - shippingDiscount));
    const productDiscount = discountCalculation.productDiscount;
    const total = roundMoney(Math.max(0, subtotal - productDiscount + shipping));
    const warnings = [
      ...this.paymentRules.warnings(paymentMethods),
      ...this.deliveryRules.warnings(shippingOptions, lines, delivery),
    ];

    return {
      baseShipping: delivery.baseCost,
      coupon: couponCalculation?.projection,
      ...(couponCalculation ? { couponCalculation } : {}),
      currency: CHECKOUT_CURRENCY,
      delivery: { ...delivery, cost: shipping },
      discount: productDiscount,
      items: lines.map(toQuoteItem),
      lines,
      paymentMethods,
      pickupPoints,
      quoteId: createQuoteId(),
      selectedPayment,
      shipping,
      shippingDiscount,
      shippingOptions,
      subtotal,
      total,
      warnings,
    };
  }

  async assertItemReferences(
    transaction: TransactionClient,
    items: readonly CheckoutQuoteRequest["items"][number][],
  ): Promise<void> {
    for (const item of items) {
      const product = await this.catalogRepository.checkoutProductById(transaction, item.productId);
      if (!product) throw this.productNotFound();
      if (item.variantId && !product.variants.some((variant) => variant.id === item.variantId)) {
        throw this.variantNotFound();
      }
    }
  }

  async resolveCart(
    transaction: TransactionClient,
    input: CheckoutCalculationInput,
    actor: CheckoutActorContext | undefined,
  ) {
    const owner: CheckoutOwner = {
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      ...(actor?.userId ? { userId: actor.userId } : {}),
    };
    const resolution = await this.checkoutRepository.resolveCart(transaction, owner);
    if (!resolution) throw this.invalidSession();
    return resolution;
  }

  private publicQuote(calculation: QuoteCalculation): CheckoutQuoteProjection {
    return {
      ...(calculation.coupon === undefined ? {} : { coupon: calculation.coupon }),
      currency: calculation.currency,
      discount: calculation.discount,
      ...(calculation.expiresAt === undefined ? {} : { expiresAt: calculation.expiresAt }),
      items: calculation.items,
      paymentMethods: calculation.paymentMethods,
      pickupPoints: calculation.pickupPoints,
      quoteId: calculation.quoteId,
      ...(calculation.sessionToken === undefined ? {} : { sessionToken: calculation.sessionToken }),
      shipping: calculation.shipping,
      shippingOptions: calculation.shippingOptions,
      subtotal: calculation.subtotal,
      total: calculation.total,
      warnings: calculation.warnings,
    };
  }

  private quoteSnapshot(calculation: QuoteCalculation, quoteId: string, expiresAt: Date): Prisma.InputJsonValue {
    return {
      discount: calculation.discount,
      expiresAt: expiresAt.toISOString(),
      items: calculation.lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        variantId: line.variant?.id ?? null,
      })),
      quoteId,
      shipping: calculation.shipping,
      subtotal: calculation.subtotal,
      total: calculation.total,
    };
  }

  private assertActor(actor: CheckoutActorContext | undefined): void {
    if (actor?.role === Role.ADMIN) throw this.forbidden();
    if (actor?.role === Role.CUSTOMER && !actor.userId) throw this.unauthorized();
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

  private shippingUnavailable(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE, message: "The selected shipping option is unavailable.", ok: false });
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODE.CHECKOUT_SESSION_INVALID, message: "The checkout session is invalid or expired.", ok: false });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({ code: ERROR_CODE.FORBIDDEN, message: "Forbidden.", ok: false });
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized.", ok: false });
  }
}

function toQuoteItem(line: ResolvedCheckoutLine): CheckoutQuoteItemProjection {
  return {
    availableQuantity: line.availableQuantity,
    ...(line.compareAtPrice === undefined ? {} : { compareAtPrice: line.compareAtPrice }),
    lineSubtotal: line.lineSubtotal,
    productId: line.product.id,
    productName: line.product.name,
    quantity: line.quantity,
    sku: line.variant?.sku ?? line.product.sku,
    unitPrice: line.unitPrice,
    ...(line.variant ? { variantId: line.variant.id, variantName: line.variant.name } : {}),
    ...(line.weightGrams === null ? {} : { weightGrams: line.weightGrams }),
  };
}

function createQuoteId(): string {
  return randomBytes(24).toString("base64url");
}
