import { z } from "zod";

import { mockAbandonedCarts, mockRecoveryConfig, mockRecoveryEmailTemplate } from "@/lib/data/admin/sales-flow/abandonedCarts";
import type { AbandonedCart as LegacyAbandonedCart } from "@/lib/data/admin/sales-flow/types";

import { AbandonedCartsApiError } from "./client";
import {
  abandonedCartIdParamSchema,
  abandonedCartListQuerySchema,
  convertCartSchema,
  discardCartSchema,
  manualRecoverySchema,
  recoveryConfigPatchSchema,
  recoveryTemplatePatchSchema,
  sendRecoveryEmailSchema,
  toValidationIssues,
} from "./contracts";
import type { AbandonedCartsRepository } from "./repository";
import {
  ABANDONED_CART_SORT_BY,
  RECOVERY_STATUS,
  type AbandonedCart,
  type AbandonedCartCustomerSummary,
  type AbandonedCartDetail,
  type AbandonedCartListItem,
  type AbandonedCartListQuery,
  type AbandonedCartListResult,
  type AbandonedCartProductSummary,
  type AbandonedCartRecoveryLink,
  type CheckoutSessionHistoryEvent,
  type ParsedAbandonedCartListQuery,
  type RecoveryActionResult,
  type RecoveryConfig,
  type RecoveryEmailTemplate,
  type RecoveryStatus,
} from "./types";

interface MockAbandonedCartRecord extends AbandonedCartDetail {
  issuedRecoveryLink?: AbandonedCartRecoveryLink;
}

type MockAbandonedCartInput = LegacyAbandonedCart | AbandonedCartListItem;

const RECOVERY_TRANSITIONS: Record<RecoveryStatus, readonly RecoveryStatus[]> = {
  [RECOVERY_STATUS.DISCARDED]: [],
  [RECOVERY_STATUS.MANUAL]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
  [RECOVERY_STATUS.PENDING]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
  [RECOVERY_STATUS.RECOVERED]: [],
  [RECOVERY_STATUS.SENT]: [RECOVERY_STATUS.SENT, RECOVERY_STATUS.MANUAL, RECOVERY_STATUS.RECOVERED, RECOVERY_STATUS.DISCARDED],
};

export class MockAbandonedCartsRepository implements AbandonedCartsRepository {
  readonly source = "mock" as const;
  private carts: MockAbandonedCartRecord[];
  private config: RecoveryConfig;
  private template: RecoveryEmailTemplate;
  private eventSequence = 0;

  constructor(
    initialCarts: readonly MockAbandonedCartInput[] = mockAbandonedCarts,
    initialConfig: RecoveryConfig = mockRecoveryConfig,
    initialTemplate: RecoveryEmailTemplate = mockRecoveryEmailTemplate,
  ) {
    this.carts = initialCarts.map(toRecord);
    this.config = { ...initialConfig };
    this.template = { ...initialTemplate };
  }

  async list(query: AbandonedCartListQuery = {}): Promise<AbandonedCartListResult> {
    const parsed = parse(abandonedCartListQuerySchema, query, "The abandoned-cart list query is invalid.") as ParsedAbandonedCartListQuery;
    const filtered = this.carts.filter((cart) => matches(cart, parsed)).sort((left, right) => compare(left, right, parsed));
    const start = (parsed.page - 1) * parsed.limit;
    const items = filtered.slice(start, start + parsed.limit).map(toListItem);
    return {
      items,
      limit: parsed.limit,
      page: parsed.page,
      summary: {
        pendingCount: filtered.filter((cart) => cart.recoveryStatus === RECOVERY_STATUS.PENDING).length,
        recoverableTotal: filtered.filter(isRecoverable).reduce((total, cart) => total + cart.total, 0),
        recoveredCount: filtered.filter((cart) => cart.recoveryStatus === RECOVERY_STATUS.RECOVERED).length,
      },
      total: filtered.length,
      totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / parsed.limit),
    };
  }

  async getById(id: string): Promise<AbandonedCartDetail> {
    return toDetail(this.find(id));
  }

  async sendRecoveryEmail(id: string, note?: string): Promise<RecoveryActionResult> {
    const cart = this.find(id);
    const payload = parse(sendRecoveryEmailSchema, note === undefined ? {} : { note }, "The recovery-email payload is invalid.");
    this.assertTransition(cart, RECOVERY_STATUS.SENT);
    if (!cart.customer.email) throw repositoryError("BAD_REQUEST", "The abandoned cart has no customer email address.", 400);
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1_000);
    const token = `mock-${cart.id}-${Date.now()}`;
    const recoveryLink: AbandonedCartRecoveryLink = { expiresAt: expiresAt.toISOString(), isExpired: false, url: `/checkout?recoveryToken=${encodeURIComponent(token)}` };
    cart.recoveryStatus = RECOVERY_STATUS.SENT;
    cart.lastEmailSentAt = sentAt.toISOString();
    cart.recoveryExpiresAt = expiresAt.toISOString();
    cart.issuedRecoveryLink = recoveryLink;
    this.addEvent(cart, "RECOVERY_EMAIL_SENT", payload.note, { channel: "email", expiresAt: recoveryLink.expiresAt });
    return action(cart, recoveryLink);
  }

  async markManualRecovery(id: string, notes?: string): Promise<RecoveryActionResult> {
    const cart = this.find(id);
    const payload = parse(manualRecoverySchema, notes === undefined ? {} : { note: notes }, "The manual-recovery payload is invalid.");
    this.assertTransition(cart, RECOVERY_STATUS.MANUAL);
    cart.recoveryStatus = RECOVERY_STATUS.MANUAL;
    cart.issuedRecoveryLink = undefined;
    this.addEvent(cart, "MANUAL_CONTACT_LOGGED", payload.note, { channel: "manual" });
    return action(cart, null);
  }

  async convertCart(id: string): Promise<RecoveryActionResult> {
    const cart = this.find(id);
    parse(convertCartSchema, {}, "The conversion payload is invalid.");
    this.assertTransition(cart, RECOVERY_STATUS.RECOVERED);
    const orderId = `order-recovery-${cart.id.toLowerCase()}-${Date.now()}`;
    cart.recoveryStatus = RECOVERY_STATUS.RECOVERED;
    cart.issuedRecoveryLink = undefined;
    this.addEvent(cart, "SESSION_RECOVERED", undefined, { orderId });
    return action(cart, null, orderId);
  }

  async discardCart(id: string, reason: string): Promise<RecoveryActionResult> {
    const cart = this.find(id);
    const payload = parse(discardCartSchema, { reason }, "A discard reason is required.");
    this.assertTransition(cart, RECOVERY_STATUS.DISCARDED);
    cart.recoveryStatus = RECOVERY_STATUS.DISCARDED;
    cart.issuedRecoveryLink = undefined;
    this.addEvent(cart, "SESSION_DISCARDED", payload.reason, { reason: payload.reason });
    return action(cart, null);
  }

  async getConfig(): Promise<RecoveryConfig> {
    return { ...this.config };
  }

  async updateConfig(config: Partial<RecoveryConfig>): Promise<RecoveryConfig> {
    const patch = parse(recoveryConfigPatchSchema, config, "The recovery configuration is invalid.");
    this.config = { ...this.config, ...patch };
    return { ...this.config };
  }

  async getTemplate(): Promise<RecoveryEmailTemplate> {
    return { ...this.template };
  }

  async updateTemplate(template: Partial<RecoveryEmailTemplate>): Promise<RecoveryEmailTemplate> {
    const patch = parse(recoveryTemplatePatchSchema, template, "The recovery email template is invalid.");
    this.template = { ...this.template, ...patch };
    return { ...this.template };
  }

  private find(id: string): MockAbandonedCartRecord {
    const cartId = parse(abandonedCartIdParamSchema, { id }, "The abandoned-cart identifier is invalid.").id;
    const cart = this.carts.find((entry) => entry.id === cartId);
    if (!cart) throw repositoryError("NOT_FOUND", "The requested abandoned cart was not found.", 404);
    return cart;
  }

  private assertTransition(cart: MockAbandonedCartRecord, targetStatus: RecoveryStatus): void {
    if (!RECOVERY_TRANSITIONS[cart.recoveryStatus].includes(targetStatus)) {
      throw repositoryError("CONFLICT", `Recovery status cannot transition from ${cart.recoveryStatus} to ${targetStatus}.`, 409);
    }
  }

  private addEvent(cart: MockAbandonedCartRecord, eventType: string, notes?: string, metadata?: Record<string, unknown>): void {
    this.eventSequence += 1;
    cart.timeline.push({
      createdAt: new Date().toISOString(),
      eventType,
      id: `${cart.id}-event-${this.eventSequence}`,
      ...(metadata ? { metadata: cloneMetadata(metadata) } : {}),
      ...(notes ? { notes } : {}),
    });
  }
}

function toRecord(input: MockAbandonedCartInput): MockAbandonedCartRecord {
  const products = input.products.map(toProduct);
  const recoveryStatus = normalizeStatus(input.recoveryStatus);
  const abandonedAt = input.abandonedAt;
  const detailInput = isAbandonedCartDetail(input) ? input : undefined;
  const cartId = detailInput?.cartId ?? `cart-${input.id}`;
  const timeline = detailInput ? detailInput.timeline.map(cloneEvent) : buildTimeline(input.id, abandonedAt, recoveryStatus, input.lastEmailSentAt);
  return {
    abandonedAt,
    cartId,
    customer: toCustomer(input.customer),
    id: input.id,
    items: products.map(cloneProduct),
    lastEmailSentAt: input.lastEmailSentAt,
    products,
    recoveryStatus,
    recoveryExpiresAt: detailInput?.recoveryExpiresAt,
    recoveryLink: detailInput?.recoveryLink,
    timeline,
    total: input.total,
  };
}

function toListItem(cart: MockAbandonedCartRecord): AbandonedCartListItem {
  return {
    abandonedAt: cart.abandonedAt,
    customer: cloneCustomer(cart.customer),
    id: cart.id,
    ...(cart.lastEmailSentAt === undefined ? {} : { lastEmailSentAt: cart.lastEmailSentAt }),
    products: cart.products.map(cloneProduct),
    recoveryStatus: cart.recoveryStatus,
    total: cart.total,
  };
}

function toDetail(cart: MockAbandonedCartRecord): AbandonedCartDetail {
  return {
    ...toListItem(cart),
    cartId: cart.cartId,
    items: cart.items.map(cloneProduct),
    ...(cart.recoveryExpiresAt === undefined ? {} : { recoveryExpiresAt: cart.recoveryExpiresAt }),
    timeline: cart.timeline.map(cloneEvent),
  };
}

function action(cart: MockAbandonedCartRecord, recoveryLink: AbandonedCartRecoveryLink | null, orderId?: string): RecoveryActionResult {
  return {
    cart: toListItem(cart),
    ...(orderId ? { orderId } : {}),
    recoveryLink: recoveryLink ? { ...recoveryLink } : null,
  };
}

function matches(cart: MockAbandonedCartRecord, query: ParsedAbandonedCartListQuery): boolean {
  const search = query.search?.toLowerCase();
  const haystack = [cart.id, cart.customer.firstName, cart.customer.lastName, cart.customer.email, cart.customer.phone, cart.customer.dni, ...cart.products.flatMap((product) => [product.name, product.sku, product.variantName])]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  const abandonedTimestamp = Date.parse(cart.abandonedAt);
  const from = query.from === undefined ? undefined : dateValue(query.from);
  const to = query.to === undefined ? undefined : dateValue(query.to);
  return (!search || haystack.includes(search))
    && (!query.status || cart.recoveryStatus === query.status)
    && (from === undefined || abandonedTimestamp >= from)
    && (to === undefined || abandonedTimestamp <= to)
    && (query.minTotal === undefined || cart.total >= query.minTotal)
    && (query.maxTotal === undefined || cart.total <= query.maxTotal);
}

function compare(left: MockAbandonedCartRecord, right: MockAbandonedCartRecord, query: ParsedAbandonedCartListQuery): number {
  const value = (cart: MockAbandonedCartRecord): string | number => {
    switch (query.sortBy) {
      case ABANDONED_CART_SORT_BY.CUSTOMER_NAME: return `${cart.customer.lastName} ${cart.customer.firstName}`.toLowerCase();
      case ABANDONED_CART_SORT_BY.TOTAL: return cart.total;
      case ABANDONED_CART_SORT_BY.RECOVERY_STATUS: return cart.recoveryStatus;
      case ABANDONED_CART_SORT_BY.CREATED_AT:
      case ABANDONED_CART_SORT_BY.LAST_ACTIVITY_AT:
      case ABANDONED_CART_SORT_BY.UPDATED_AT:
      case ABANDONED_CART_SORT_BY.ABANDONED_AT: return cart.abandonedAt;
    }
  };
  const leftValue = value(left);
  const rightValue = value(right);
  const difference = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
  if (difference !== 0) return query.sortOrder === "asc" ? difference : -difference;
  return query.sortOrder === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
}

function isRecoverable(cart: MockAbandonedCartRecord): boolean {
  return cart.recoveryStatus === RECOVERY_STATUS.PENDING || cart.recoveryStatus === RECOVERY_STATUS.SENT || cart.recoveryStatus === RECOVERY_STATUS.MANUAL;
}

function buildTimeline(id: string, abandonedAt: string, status: RecoveryStatus, lastEmailSentAt?: string | null): CheckoutSessionHistoryEvent[] {
  const base = validDate(abandonedAt);
  const events: CheckoutSessionHistoryEvent[] = [
    { createdAt: base.toISOString(), eventType: "SESSION_CREATED", id: `${id}-created` },
    { createdAt: new Date(base.getTime() + 1).toISOString(), eventType: "SESSION_ABANDONED", id: `${id}-abandoned` },
  ];
  if (status === RECOVERY_STATUS.SENT) events.push({ createdAt: validDate(lastEmailSentAt ?? new Date(base.getTime() + 2).toISOString()).toISOString(), eventType: "RECOVERY_EMAIL_SENT", id: `${id}-email` });
  if (status === RECOVERY_STATUS.MANUAL) events.push({ createdAt: new Date(base.getTime() + 2).toISOString(), eventType: "MANUAL_CONTACT_LOGGED", id: `${id}-manual` });
  if (status === RECOVERY_STATUS.RECOVERED) events.push({ createdAt: new Date(base.getTime() + 2).toISOString(), eventType: "SESSION_RECOVERED", id: `${id}-recovered` });
  if (status === RECOVERY_STATUS.DISCARDED) events.push({ createdAt: new Date(base.getTime() + 2).toISOString(), eventType: "SESSION_DISCARDED", id: `${id}-discarded` });
  return events;
}

function toCustomer(customer: LegacyAbandonedCart["customer"] | AbandonedCart["customer"]): AbandonedCartCustomerSummary {
  const result: AbandonedCartCustomerSummary = { firstName: customer.firstName, lastName: customer.lastName };
  if ("dni" in customer && customer.dni !== undefined) result.dni = customer.dni;
  if ("dniOrCuil" in customer && customer.dniOrCuil !== undefined) result.dni = customer.dniOrCuil;
  if (customer.email !== undefined) result.email = customer.email;
  if (customer.phone !== undefined) result.phone = customer.phone;
  return result;
}

function toProduct(product: LegacyAbandonedCart["products"][number] | AbandonedCart["products"][number]): AbandonedCartProductSummary {
  const sku = "sku" in product ? product.sku : undefined;
  const variantName = "variantName" in product ? product.variantName : undefined;
  return {
    ...("lineSubtotal" in product && product.lineSubtotal !== undefined ? { lineSubtotal: product.lineSubtotal } : { lineSubtotal: product.unitPrice * product.quantity }),
    name: product.name,
    productId: product.productId,
    quantity: product.quantity,
    ...(sku === undefined ? {} : { sku }),
    unitPrice: product.unitPrice,
    ...(product.variantId === undefined ? {} : { variantId: product.variantId }),
    ...(variantName === undefined ? {} : { variantName }),
  };
}

function isAbandonedCartDetail(input: MockAbandonedCartInput): input is AbandonedCartDetail {
  return "cartId" in input && "timeline" in input;
}

function normalizeStatus(value: string): RecoveryStatus {
  const candidate = value.trim().toUpperCase();
  if (Object.values(RECOVERY_STATUS).includes(candidate as RecoveryStatus)) return candidate as RecoveryStatus;
  throw repositoryError("VALIDATION_ERROR", "The abandoned-cart recovery status is invalid.", 400);
}

function cloneCustomer(customer: AbandonedCartCustomerSummary): AbandonedCartCustomerSummary { return { ...customer }; }
function cloneProduct(product: AbandonedCartProductSummary): AbandonedCartProductSummary { return { ...product }; }
function cloneEvent(event: CheckoutSessionHistoryEvent): CheckoutSessionHistoryEvent { return { ...event, ...(event.metadata ? { metadata: cloneMetadata(event.metadata) } : {}) }; }
function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, cloneValue(value)])); }
function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return cloneMetadata(value as Record<string, unknown>);
  return value;
}
function dateValue(value: Date | string): number { return value instanceof Date ? value.getTime() : Date.parse(value); }
function validDate(value: string): Date { const date = new Date(value); return Number.isNaN(date.getTime()) ? new Date() : date; }
function repositoryError(code: string, message: string, status: number, issues: readonly { code: string; field: string; message: string }[] = []): AbandonedCartsApiError { return new AbandonedCartsApiError({ code, message, status, issues }); }
function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T { const result = schema.safeParse(value); if (result.success) return result.data; throw repositoryError("VALIDATION_ERROR", message, 400, toValidationIssues(result.error)); }
