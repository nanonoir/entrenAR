import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { InventoryMovementKind, InventoryReferenceType, PaymentProvider, Role } from "../../generated/prisma/enums";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { cardTokenDigest } from "../payments/payment-card";
import { CHECKOUT_PAYMENT_METHOD } from "./checkout.constants";
import { toCheckoutCompleteResponse } from "./checkout.mapper";
import {
  checkoutCompleteResponseSchema,
  type CheckoutCardPaymentRequest,
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

export interface CardPlacement {
  attemptId: string;
  /** False when an idempotent replay returned an earlier placement: nothing must be dispatched again. */
  created: boolean;
  orderId: string;
}

const CARD_IDEMPOTENCY_PREFIX = "mp-card:";

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

      const { now, order, resolution } = await this.placeOrder(transaction, input, actor, snapshotOperations, false);

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

  /**
   * Places a Mercado Pago card order: the same atomic placement as `complete`, plus the first SUBMITTING payment
   * attempt, but the cart and session stay untouched until the payment outcome finalizes them.
   */
  async placeCardOrder(
    input: CheckoutCardPaymentRequest,
    actor: CheckoutActorContext | undefined,
    snapshotOperations: CheckoutCompletionSnapshotOperations,
  ): Promise<CardPlacement> {
    this.assertActor(actor);
    if (!actor?.userId && !input.sessionToken) throw this.invalidSession();

    const { card, deviceId: _deviceId, ...selection } = input;
    const completeInput: CheckoutCompleteRequest = { ...selection, paymentMethodId: CHECKOUT_PAYMENT_METHOD.MERCADO_PAGO };
    const { idempotencyKey, sessionToken: _sessionToken, ...intent } = selection;
    const requestHash = hashCheckoutRequest({
      card: { ...card, token: cardTokenDigest(card.token) },
      intent,
      op: "mp-card",
    });
    const storedKey = `${CARD_IDEMPOTENCY_PREFIX}${idempotencyKey}`;

    return this.checkoutRepository.transaction(async (transaction) => {
      const ownerKey = await this.ownerKeyForCompletion(transaction, completeInput, actor);
      const existing = await this.checkoutRepository.idempotencyByOwnerAndKey(transaction, ownerKey, storedKey);
      if (existing) return this.replayCard(existing, requestHash);

      const claim = await this.checkoutRepository.claimIdempotency(transaction, ownerKey, storedKey, requestHash);
      if (!claim.created) return this.replayCard(claim.record, requestHash);

      const { now, order } = await this.placeOrder(transaction, completeInput, actor, snapshotOperations, true);
      const attempt = await this.checkoutRepository.createPaymentAttempt(transaction, {
        clientKey: idempotencyKey,
        expectedAmount: Number(order.total),
        orderId: order.id,
        providerIdempotencyKey: randomUUID(),
        requestHash,
      });
      await this.checkoutRepository.completeIdempotency(
        transaction,
        claim.record.id,
        order.id,
        { attemptId: attempt.id, orderId: order.id },
        now,
      );

      return { attemptId: attempt.id, created: true, orderId: order.id };
    });
  }

  private async placeOrder(
    transaction: TransactionClient,
    input: CheckoutCompleteRequest,
    actor: CheckoutActorContext | undefined,
    snapshotOperations: CheckoutCompletionSnapshotOperations,
    card: boolean,
  ) {
    const resolution = await this.quoteService.resolveCart(transaction, input, actor);
    if (await this.checkoutRepository.orderIdBySession(transaction, resolution.session.id)) throw this.sessionAlreadyBound();
    if (!resolution.merged) await this.quoteService.assertItemReferences(transaction, input.items);
    const cart = resolution.merged
      ? resolution.cart
      : await this.checkoutRepository.replaceCartItems(transaction, resolution.cart.id, input.items);
    const now = new Date();
    const calculation = await this.quoteService.calculateQuote(transaction, cart, input, actor, now, true);
    this.assertQuoteContinuity(resolution.session, input.quoteId, calculation, now);
    this.assertPaymentChannel(calculation, card);

    if (calculation.couponCalculation) {
      const usageApplied = await this.checkoutRepository.incrementCouponUsage(
        transaction,
        calculation.couponCalculation.record.id,
      );
      if (!usageApplied) throw this.discountRules.couponUsageLimitReached();
    }

    const builtInput = await snapshotOperations.createOrderInput(
      transaction,
      calculation,
      resolution,
      input,
      actor,
      now,
    );
    const orderInput: CheckoutOrderCreateInput = card
      ? { ...builtInput, payment: { ...builtInput.payment, provider: PaymentProvider.MERCADOPAGO } }
      : builtInput;
    const order = await this.checkoutRepository.createPendingOrder(transaction, orderInput);
    const inventoryEffectId = randomUUID();

    try {
      const movements = await this.checkoutRepository.deductStockForItems(
        transaction,
        calculation.lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          ...(line.variant ? { variantId: line.variant.id } : {}),
        })),
        {
          inventoryEffectId,
          movementKind: InventoryMovementKind.CHECKOUT_DEDUCTION,
          operationId: randomUUID(),
          origin: INVENTORY_ORIGIN.CHECKOUT,
          reason: `Checkout order ${order.number} placement`,
          referenceId: order.id,
          referenceType: InventoryReferenceType.ORDER,
        },
      );
      if (movements.length > 0) {
        await this.checkoutRepository.assignInventoryOwnership(transaction, order.id, inventoryEffectId);
      }
    } catch {
      throw this.outOfStock();
    }

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

    return { now, order, resolution };
  }

  /** Mercado Pago orders only exist through the card endpoint, and the card endpoint only creates Mercado Pago orders. */
  private assertPaymentChannel(calculation: QuoteCalculation, card: boolean): void {
    const isMercadoPago = calculation.selectedPayment?.method.id === CHECKOUT_PAYMENT_METHOD.MERCADO_PAGO;
    if (isMercadoPago !== card) throw this.paymentMethodUnavailable();
  }

  private replayCard(record: CheckoutIdempotencyRecord, requestHash: string): CardPlacement {
    if (record.requestHash !== requestHash) throw this.idempotencyKeyReused();
    const stored = record.responseSnapshot;
    if (record.status !== "COMPLETED" || !stored || typeof stored !== "object" || Array.isArray(stored)) {
      throw this.completionInProgress();
    }
    const { attemptId, orderId } = stored as Record<string, unknown>;
    if (typeof attemptId !== "string" || typeof orderId !== "string") throw new Error("Stored card checkout response is invalid.");

    return { attemptId, created: false, orderId };
  }

  private sessionAlreadyBound(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.CONFLICT, message: "The checkout session is already bound to an order.", ok: false });
  }

  private paymentMethodUnavailable(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.PAYMENT_METHOD_UNAVAILABLE, message: "The selected payment method is unavailable.", ok: false });
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
