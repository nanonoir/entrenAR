import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { Prisma } from "../../generated/prisma/client";
import { CheckoutRecoveryStatus, CheckoutSessionStatus, OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import { toAbandonedCartDetailDto, toAbandonedCartListItemDto, type AbandonedCartDetailDto, type AbandonedCartSessionRecord } from "./abandoned-carts.mapper";
import { abandonedCartListQuerySchema, convertCartSchema, discardCartSchema, manualRecoverySchema, RECOVERY_STATUS, RECOVERY_TIMING, recoveryTimingSchema, sendRecoveryEmailSchema, updateRecoveryConfigSchema, updateRecoveryTemplateSchema, type AbandonedCartListQuery, type AbandonedCartListResponse, type ConvertCartInput, type DiscardCartInput, type ManualRecoveryInput, type RecoveryTiming, type SendRecoveryEmailInput, type UpdateRecoveryConfigInput, type UpdateRecoveryTemplateInput } from "./abandoned-carts.schemas";
import { assertRecoveryTransition, isSessionAbandoned, RecoveryTransitionError, resolveTimingThresholdMs } from "./abandoned-carts.state-machine";
import { AbandonedCartsRepository, type AbandonedCartsClient, type CartRecoverySettingsRecord, type TransactionClient } from "./abandoned-carts.repository";

const RECOVERY_EMAIL_EVENT = "RECOVERY_EMAIL_SENT", MANUAL_RECOVERY_EVENT = "MANUAL_CONTACT_LOGGED", SESSION_RECOVERED_EVENT = "SESSION_RECOVERED", SESSION_DISCARDED_EVENT = "SESSION_DISCARDED";
const RECOVERY_PATH = "/checkout";
const RECOVERY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface RecoveryConfigDto { isActive: boolean; timing: RecoveryTiming; }
export interface RecoveryEmailTemplateDto { htmlBody: string; plainTextBody: string; subject: string; }
export interface SendRecoveryEmailResult { cart: AbandonedCartDetailDto; rawToken: string; recoveryLink: string; }

export type ConvertedAbandonedCartDetail = AbandonedCartDetailDto & { orderId: string };

@Injectable()
export class AbandonedCartsService {
  constructor(private readonly abandonedCartsRepository: AbandonedCartsRepository) {}

  async listAbandonedCarts(query: AbandonedCartListQuery = abandonedCartListQuerySchema.parse({})): Promise<AbandonedCartListResponse> {
    const parsedQuery = parseInput(abandonedCartListQuerySchema, query, "The abandoned-cart list query is invalid.");
    const result = await this.abandonedCartsRepository.findMany(parsedQuery);
    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / parsedQuery.limit);

    return {
      items: result.items.map((session) => toAbandonedCartListItemDto(session)),
      limit: parsedQuery.limit,
      page: parsedQuery.page,
      summary: {
        pendingCount: result.metrics.pendingCount,
        recoverableTotal: result.metrics.recoverableTotal,
        recoveredCount: result.metrics.recoveredCount,
      },
      total: result.total,
      totalPages,
    };
  }

  async evaluateAbandonment(now = new Date()): Promise<number> {
    const settings = await this.abandonedCartsRepository.getSettings();
    if (!settings.isActive || settings.timing === RECOVERY_TIMING.MANUAL) return 0;
    const timing = recoveryTimingSchema.parse(settings.timing);
    const thresholdMs = resolveTimingThresholdMs(timing);
    const candidates = await this.abandonedCartsRepository.findMany(
      { includeActiveStale: true, abandonmentThresholdMs: thresholdMs, now },
      { limit: 100, page: 1 },
      { sortBy: "lastActivityAt", sortOrder: "asc" },
    );
    return this.abandonedCartsRepository.runInTransaction(async (transaction) => {
      let changed = 0;
      for (const session of candidates.items) {
        if (!isSessionAbandoned(session.lastActivityAt, thresholdMs, session.status, now)) continue;
        const result = await transaction.checkoutSession.updateMany({ data: { abandonedAt: now, recoveryStatus: CheckoutRecoveryStatus.PENDING, status: CheckoutSessionStatus.ABANDONED }, where: { id: session.id, lastActivityAt: { lt: new Date(now.getTime() - thresholdMs) }, status: CheckoutSessionStatus.ACTIVE } });
        if (result.count !== 1) continue;
        await this.abandonedCartsRepository.appendHistoryEvent(session.id, "SESSION_ABANDONED", undefined, "SYSTEM", "Session exceeded the configured inactivity threshold.", { thresholdMs }, transaction);
        changed++;
      }
      return changed;
    });
  }

  async getAbandonedCartById(id: string): Promise<AbandonedCartDetailDto> {
    const session = await this.currentOrThrow(id);
    return toAbandonedCartDetailDto(session);
  }

  async sendRecoveryEmail(
    id: string,
    payload: SendRecoveryEmailInput = {},
    actorId?: string,
    actorRole?: string,
  ): Promise<SendRecoveryEmailResult> {
    const input = parseInput(sendRecoveryEmailSchema, payload, "The recovery-email payload is invalid.");

    return this.abandonedCartsRepository.runInTransaction(async (transaction) => {
      const current = await this.currentOrThrow(id, transaction);
      this.assertTransition(current.recoveryStatus, RECOVERY_STATUS.SENT);

      const currentDetail = toAbandonedCartDetailDto(current);
      if (!currentDetail.customer.email) throw this.missingCustomerEmail();

      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + RECOVERY_TOKEN_TTL_MS);

      await this.abandonedCartsRepository.updateRecoveryEmailSent(
        id,
        tokenHash,
        expiresAt,
        sentAt,
        transaction,
      );
      await this.abandonedCartsRepository.appendHistoryEvent(
        id,
        RECOVERY_EMAIL_EVENT,
        actorId,
        actorRole,
        textValue(input.note),
        {
          channel: "email",
          expiresAt: expiresAt.toISOString(),
          ...(textValue(input.subjectOverride) ? { subjectOverride: textValue(input.subjectOverride) } : {}),
        },
        transaction,
      );

      const updated = await this.currentOrThrow(id, transaction);
      const cart = toAbandonedCartDetailDto(updated, { now: sentAt, recoveryToken: rawToken });
      const recoveryLink = cart.recoveryLink?.url ?? formatRecoveryLink(rawToken);
      return { cart, rawToken, recoveryLink };
    });
  }

  async markManualRecovery(
    id: string,
    payload: ManualRecoveryInput = {},
    actorId?: string,
    actorRole?: string,
  ): Promise<AbandonedCartDetailDto> {
    const input = parseInput(manualRecoverySchema, payload, "The manual-recovery payload is invalid.");
    return this.transitionWithHistory(
      id,
      RECOVERY_STATUS.MANUAL,
      MANUAL_RECOVERY_EVENT,
      actorId,
      actorRole,
      textValue(input.note),
      { channel: "manual" },
    );
  }

  async convertAbandonedCart(
    id: string,
    payload: ConvertCartInput = {},
    actorId?: string,
    actorRole?: string,
  ): Promise<ConvertedAbandonedCartDetail> {
    const input = parseInput(convertCartSchema, payload, "The abandoned-cart conversion payload is invalid.");

    return this.abandonedCartsRepository.runInTransaction(async (transaction) => {
      const current = await this.currentOrThrow(id, transaction);
      this.assertTransition(current.recoveryStatus, RECOVERY_STATUS.RECOVERED);

      if (current.order && current.order.status !== undefined && current.order.status !== OrderStatus.PENDING) {
        throw this.conflict("Only pending orders can be linked to an abandoned-cart recovery.");
      }
      const orderId = current.order?.id ?? await this.createPendingOrder(transaction, current);
      const completedAt = new Date();
      await this.abandonedCartsRepository.updateRecoveryStatus(
        id,
        CheckoutRecoveryStatus.RECOVERED,
        transaction,
        { completedAt, sessionStatus: CheckoutSessionStatus.COMPLETED },
      );
      await this.abandonedCartsRepository.appendHistoryEvent(
        id,
        SESSION_RECOVERED_EVENT,
        actorId,
        actorRole,
        textValue(input.notes),
        { orderId },
        transaction,
      );

      const updated = await this.currentOrThrow(id, transaction);
      return { ...toAbandonedCartDetailDto(updated), orderId };
    });
  }

  async discardAbandonedCart(
    id: string,
    payload: DiscardCartInput,
    actorId?: string,
    actorRole?: string,
  ): Promise<AbandonedCartDetailDto> {
    const input = parseInput(discardCartSchema, payload, "A discard reason is required.");
    return this.transitionWithHistory(
      id,
      RECOVERY_STATUS.DISCARDED,
      SESSION_DISCARDED_EVENT,
      actorId,
      actorRole,
      textValue(input.reason),
      { reason: textValue(input.reason) ?? "" },
    );
  }

  async getRecoveryConfig(): Promise<RecoveryConfigDto> {
    return mapRecoveryConfig(await this.abandonedCartsRepository.getSettings());
  }

  async updateRecoveryConfig(data: UpdateRecoveryConfigInput): Promise<RecoveryConfigDto> {
    const input = parseInput(updateRecoveryConfigSchema, data, "The recovery configuration is invalid.");
    const settings = await this.abandonedCartsRepository.updateSettings(input);
    return mapRecoveryConfig(settings);
  }

  async getRecoveryTemplate(): Promise<RecoveryEmailTemplateDto> {
    return mapRecoveryTemplate(await this.abandonedCartsRepository.getSettings());
  }

  async updateRecoveryTemplate(data: UpdateRecoveryTemplateInput): Promise<RecoveryEmailTemplateDto> {
    const input = parseInput(updateRecoveryTemplateSchema, data, "The recovery email template is invalid.");
    const settings = await this.abandonedCartsRepository.updateSettings({
      emailHtmlBody: input.htmlBody,
      emailPlainBody: input.plainTextBody,
      emailSubject: input.subject,
    });
    return mapRecoveryTemplate(settings);
  }

  private async transitionWithHistory(
    id: string,
    targetStatus: CheckoutRecoveryStatus,
    eventType: string,
    actorId: string | undefined,
    actorRole: string | undefined,
    notes: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<AbandonedCartDetailDto> {
    return this.abandonedCartsRepository.runInTransaction(async (transaction) => {
      const current = await this.currentOrThrow(id, transaction);
      this.assertTransition(current.recoveryStatus, targetStatus);
      await this.abandonedCartsRepository.updateRecoveryStatus(id, targetStatus, transaction);
      await this.abandonedCartsRepository.appendHistoryEvent(
        id,
        eventType,
        actorId,
        actorRole,
        notes,
        metadata,
        transaction,
      );
      return toAbandonedCartDetailDto(await this.currentOrThrow(id, transaction));
    });
  }

  private async currentOrThrow(id: string, client?: AbandonedCartsClient): Promise<AbandonedCartSessionRecord> {
    const session = client
      ? await this.abandonedCartsRepository.findById(id, client)
      : await this.abandonedCartsRepository.findById(id);
    if (!session) throw this.notFound();
    return session;
  }

  private assertTransition(currentStatus: CheckoutRecoveryStatus, targetStatus: CheckoutRecoveryStatus): void {
    try {
      assertRecoveryTransition(currentStatus, targetStatus);
    } catch (error) {
      if (error instanceof RecoveryTransitionError) throw this.conflict(error.message);
      throw error;
    }
  }

  private async createPendingOrder(transaction: TransactionClient, session: AbandonedCartSessionRecord): Promise<string> {
    const cart = toAbandonedCartDetailDto(session);
    const snapshot = objectRecord(session.snapshotData);
    const deliveryType = deliveryTypeFrom(snapshot);
    const subtotal = moneyValue(snapshot?.["subtotal"], cart.items.reduce((sum, item) => sum + item.lineSubtotal!, 0));
    const discountAmount = moneyValue(snapshot?.["discountAmount"] ?? snapshot?.["discount"], 0);
    const shippingCost = moneyValue(snapshot?.["shippingCost"] ?? snapshot?.["shipping"], 0);
    const total = moneyValue(snapshot?.["total"], Math.max(0, subtotal - discountAmount + shippingCost));
    const currency = textValue(snapshot?.["currency"]) ?? "ARS";
    const customerSnapshot = objectRecord(snapshot?.["customerSnapshot"])
      ?? objectRecord(snapshot?.["customer"])
      ?? cart.customer;
    const deliverySnapshot = objectRecord(snapshot?.["deliverySnapshot"])
      ?? objectRecord(snapshot?.["delivery"])
      ?? {};
    const discountSnapshot = objectRecord(snapshot?.["discountSnapshot"]) ?? {};
    const order = await transaction.order.create({
      data: {
        cartId: session.cartId,
        checkoutSessionId: session.id,
        currency,
        customerDni: cart.customer.dni ?? null,
        customerEmail: cart.customer.email ?? "",
        customerFirstName: cart.customer.firstName,
        customerLastName: cart.customer.lastName,
        customerPhone: cart.customer.phone ?? null,
        customerSnapshot: jsonInput(customerSnapshot),
        deliverySnapshot: jsonInput(deliverySnapshot),
        deliveryType,
        discountAmount,
        discountSnapshot: jsonInput(discountSnapshot),
        number: orderNumber(),
        shippingCost,
        shippingStatus: deliveryType === OrderDeliveryType.PICKUP ? OrderShippingStatus.PICKUP : OrderShippingStatus.TO_PACK,
        status: OrderStatus.PENDING,
        subtotal,
        total,
        ...(session.userId ? { userId: session.userId } : {}),
      },
      select: { id: true },
    });

    await transaction.orderItem.createMany({
      data: cart.items.map((item) => ({
        attributes: jsonInput({}),
        lineSubtotal: item.lineSubtotal ?? item.unitPrice * item.quantity,
        orderId: order.id,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        sku: item.sku ?? item.productId,
        snapshot: jsonInput({ name: item.name, unitPrice: item.unitPrice, ...(item.variantName ? { variantName: item.variantName } : {}) }),
        unitPrice: item.unitPrice,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.variantName ? { variantName: item.variantName } : {}),
      })),
    });
    const payment = objectRecord(snapshot?.["payment"]);
    await transaction.orderPayment.create({
      data: {
        amount: total,
        currency,
        orderId: order.id,
        paymentMethodId: textValue(payment?.["paymentMethodId"] ?? snapshot?.["paymentMethodId"]) ?? "manual",
        paymentMethodSnapshot: jsonInput(payment ?? {}),
        ...(textValue(payment?.["paymentOptionId"]) ? { paymentOptionId: textValue(payment?.["paymentOptionId"]) } : {}),
        status: PaymentStatus.PENDING,
      },
    });

    return order.id;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested abandoned cart was not found.", ok: false });
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ code: ERROR_CODE.CONFLICT, message, ok: false });
  }

  private missingCustomerEmail(): BadRequestException {
    return new BadRequestException({ code: ERROR_CODE.BAD_REQUEST, message: "The abandoned cart has no customer email address.", ok: false });
  }
}

function mapRecoveryConfig(settings: CartRecoverySettingsRecord): RecoveryConfigDto {
  const timing = recoveryTimingSchema.safeParse(settings.timing);
  if (!timing.success) throw new Error("Stored recovery timing is invalid.");
  return { isActive: settings.isActive, timing: timing.data };
}

function mapRecoveryTemplate(settings: CartRecoverySettingsRecord): RecoveryEmailTemplateDto { return { htmlBody: settings.emailHtmlBody, plainTextBody: settings.emailPlainBody, subject: settings.emailSubject }; }

function parseInput<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new BadRequestException({ code: ERROR_CODE.VALIDATION_ERROR, issues: parsed.error.issues.map((issue) => ({ code: issue.code, field: issue.path.join(".") || "body", message: issue.message })), message, ok: false });
}

function formatRecoveryLink(rawToken: string): string { return `${RECOVERY_PATH}?recoveryToken=${encodeURIComponent(rawToken)}`; }

function orderNumber(): string { return `EN-RECOVERY-${randomBytes(4).toString("hex").toUpperCase()}`; }

function deliveryTypeFrom(snapshot: Record<string, unknown> | undefined): OrderDeliveryType { const delivery = objectRecord(snapshot?.["delivery"]); const value = textValue(snapshot?.["deliveryType"] ?? delivery?.["type"] ?? delivery?.["deliveryType"]); return value?.toLowerCase() === "pickup" ? OrderDeliveryType.PICKUP : OrderDeliveryType.SHIPPING; }

function jsonInput(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue; }

function moneyValue(value: unknown, fallback: number): number { const parsed = numberValue(value); return parsed === undefined || parsed < 0 ? fallback : parsed; }

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const stringValue = typeof value === "string" && value.trim() ? value : value && typeof value === "object" && "toString" in value ? (value as { toString: () => string }).toString() : undefined;
  if (!stringValue) return undefined;
  const parsed = Number(stringValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }

function textValue(value: unknown): string | undefined { return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined; }
