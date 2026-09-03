import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { Role } from "../../generated/prisma/enums";
import { CHECKOUT_STOCK_DEDUCTION_STATUS } from "../inventory/inventory.repository";
import { toCheckoutCompleteResponse } from "./checkout.mapper";
import {
  checkoutCompleteResponseSchema,
  type CheckoutCompleteRequest,
} from "./checkout.schemas";
import {
  CheckoutRepository,
  hashCheckoutRequest,
  hashCheckoutToken,
  type CheckoutCartResolution,
  type CheckoutIdempotencyRecord,
  type CheckoutOrderCreateInput,
  type CheckoutSessionRecord,
  type TransactionClient,
} from "./checkout.repository";
import { CheckoutDiscountRules } from "./checkout-discount.rules";
import {
  CheckoutQuoteService,
  type CheckoutActorContext,
  type QuoteCalculation,
} from "./checkout-quote.service";

export interface CheckoutCompletionSnapshotOperations {
  createOrderInput(
    transaction: TransactionClient,
    calculation: QuoteCalculation,
    resolution: CheckoutCartResolution,
    input: CheckoutCompleteRequest,
    actor: CheckoutActorContext | undefined,
    now: Date,
  ): Promise<CheckoutOrderCreateInput>;
}

@Injectable()
export class CheckoutCompletionService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly quoteService: CheckoutQuoteService,
    private readonly discountRules: CheckoutDiscountRules,
  ) {}

  async complete(
    input: CheckoutCompleteRequest,
    actor: CheckoutActorContext | undefined,
    snapshotOperations: CheckoutCompletionSnapshotOperations,
  ): Promise<ReturnType<typeof toCheckoutCompleteResponse>> {
    this.assertActor(actor);
    if (!actor?.userId && !input.sessionToken) throw this.invalidSession();

    return this.checkoutRepository.transaction(async (transaction) => {
      const ownerKey = await this.ownerKeyForCompletion(transaction, input, actor);
      const requestHash = hashCheckoutRequest(input);
      const existing = await this.checkoutRepository.idempotencyByOwnerAndKey(
        transaction,
        ownerKey,
        input.idempotencyKey,
      );
      if (existing) return this.replayOrReject(existing, requestHash);

      const claim = await this.checkoutRepository.claimIdempotency(
        transaction,
        ownerKey,
        input.idempotencyKey,
        requestHash,
      );
      if (!claim.created) return this.replayOrReject(claim.record, requestHash);

      const resolution = await this.quoteService.resolveCart(transaction, input, actor);
      if (!resolution.merged) await this.quoteService.assertItemReferences(transaction, input.items);
      const cart = resolution.merged
        ? resolution.cart
        : await this.checkoutRepository.replaceCartItems(transaction, resolution.cart.id, input.items);
      const now = new Date();
      const calculation = await this.quoteService.calculateQuote(transaction, cart, input, actor, now, true);
      this.assertQuoteContinuity(resolution.session, input.quoteId, calculation, now);

      for (const line of calculation.lines) {
        const deduction = await this.checkoutRepository.deductStockForCheckout(
          transaction,
          line.product.id,
          line.variant?.id,
          line.quantity,
        );
        if (deduction.status === CHECKOUT_STOCK_DEDUCTION_STATUS.NOT_FOUND) {
          throw line.variant ? this.variantNotFound() : this.productNotFound();
        }
        if (deduction.status === CHECKOUT_STOCK_DEDUCTION_STATUS.OUT_OF_STOCK) {
          throw this.outOfStock();
        }
      }

      if (calculation.couponCalculation) {
        const usageApplied = await this.checkoutRepository.incrementCouponUsage(
          transaction,
          calculation.couponCalculation.record.id,
        );
        if (!usageApplied) throw this.discountRules.couponUsageLimitReached();
      }

      const orderInput = await snapshotOperations.createOrderInput(
        transaction,
        calculation,
        resolution,
        input,
        actor,
        now,
      );
      const order = await this.checkoutRepository.createPendingOrder(transaction, orderInput);

      if (calculation.couponCalculation) {
        await this.checkoutRepository.createCouponRedemption(transaction, {
          couponCode: calculation.couponCalculation.record.code,
          couponId: calculation.couponCalculation.record.id,
          ...(actor?.userId ? {} : { customerKeyHash: hashCheckoutToken(input.customer.email) }),
          discountAmount: calculation.couponCalculation.totalDiscount,
          orderId: order.id,
          ...(actor?.userId ? { userId: actor.userId } : {}),
        });
      }

      await this.checkoutRepository.clearCart(transaction, resolution.cart.id);
      await this.checkoutRepository.completeSession(transaction, resolution.session.id, now);
      const response = toCheckoutCompleteResponse(order);
      await this.checkoutRepository.completeIdempotency(
        transaction,
        claim.record.id,
        order.id,
        response,
        now,
      );

      return response;
    });
  }

  private async ownerKeyForCompletion(
    transaction: TransactionClient,
    input: CheckoutCompleteRequest,
    actor: CheckoutActorContext | undefined,
  ): Promise<string> {
    if (actor?.userId) return `user:${actor.userId}`;
    if (!input.sessionToken) throw this.invalidSession();
    const session = await this.checkoutRepository.sessionByToken(transaction, input.sessionToken);
    if (!session || session.userId || session.status !== "ACTIVE" && session.status !== "COMPLETED") {
      throw this.invalidSession();
    }
    return `session:${session.id}`;
  }

  private replayOrReject(
    record: CheckoutIdempotencyRecord,
    requestHash: string,
  ): ReturnType<typeof toCheckoutCompleteResponse> {
    if (record.requestHash !== requestHash) {
      throw this.idempotencyKeyReused();
    }
    if (record.status !== "COMPLETED" || !record.responseSnapshot) {
      throw this.completionInProgress();
    }
    const parsed = checkoutCompleteResponseSchema.safeParse(record.responseSnapshot);
    if (!parsed.success) throw new Error("Stored checkout response is invalid.");
    return parsed.data;
  }

  private assertQuoteContinuity(
    session: CheckoutSessionRecord,
    quoteId: string | undefined,
    calculation: QuoteCalculation,
    now: Date,
  ): void {
    if (!quoteId) return;
    const snapshot = session.snapshotData;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw this.priceChanged();
    const record = snapshot as Record<string, unknown>;
    if (record["quoteId"] !== quoteId) throw this.priceChanged();
    const expiresAt = typeof record["expiresAt"] === "string" ? new Date(record["expiresAt"]) : undefined;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw this.priceChanged();
    if (
      record["discount"] !== calculation.discount
      || record["shipping"] !== calculation.shipping
      || record["subtotal"] !== calculation.subtotal
      || record["total"] !== calculation.total
    ) throw this.priceChanged();

    const snapshotItems = record["items"];
    if (!Array.isArray(snapshotItems) || snapshotItems.length !== calculation.lines.length) throw this.priceChanged();
    for (const [index, line] of calculation.lines.entries()) {
      const snapshotItem = snapshotItems[index];
      if (!isQuoteSnapshotItem(snapshotItem)) throw this.priceChanged();
      if (
        snapshotItem.productId !== line.product.id
        || snapshotItem.variantId !== (line.variant?.id ?? null)
        || snapshotItem.quantity !== line.quantity
        || snapshotItem.unitPrice !== line.unitPrice
      ) throw this.priceChanged();
    }
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

  private priceChanged(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.PRICE_CHANGED, message: "The checkout quote changed before completion.", ok: false });
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODE.CHECKOUT_SESSION_INVALID, message: "The checkout session is invalid or expired.", ok: false });
  }

  private idempotencyKeyReused(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.IDEMPOTENCY_KEY_REUSED, message: "The idempotency key was already used for another request.", ok: false });
  }

  private completionInProgress(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.CONFLICT, message: "The checkout request is already being processed.", ok: false });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({ code: ERROR_CODE.FORBIDDEN, message: "Forbidden.", ok: false });
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized.", ok: false });
  }
}

interface QuoteSnapshotItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  variantId: string | null;
}

function isQuoteSnapshotItem(value: unknown): value is QuoteSnapshotItem {
  return typeof value === "object"
    && value !== null
    && "productId" in value
    && typeof value.productId === "string"
    && "quantity" in value
    && typeof value.quantity === "number"
    && "unitPrice" in value
    && typeof value.unitPrice === "number"
    && "variantId" in value
    && (typeof value.variantId === "string" || value.variantId === null);
}
