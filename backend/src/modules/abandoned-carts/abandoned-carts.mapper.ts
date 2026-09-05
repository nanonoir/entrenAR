import type { Prisma } from "../../generated/prisma/client";

import type {
  AbandonedCartCustomerSummary,
  AbandonedCartDetailResponse,
  AbandonedCartItemSummary,
  AbandonedCartProductSummary,
  AbandonedCartRecoveryLink,
  AbandonedCartTimelineEvent,
} from "./abandoned-carts.schemas";

const abandonedCartUserSelect = {
  dni: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  phone: true,
} satisfies Prisma.UserSelect;

const abandonedCartCustomerSelect = {
  dniOrCuil: true,
  email: true,
  fullName: true,
  id: true,
  phone: true,
} satisfies Prisma.CustomerSelect;

export const abandonedCartInclude = {
  cart: {
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              imageTone: true,
              name: true,
              promotionalPrice: true,
              salePrice: true,
              sku: true,
            },
          },
          variant: {
            select: {
              compareAtPrice: true,
              id: true,
              name: true,
              price: true,
              sku: true,
            },
          },
        },
        orderBy: [{ productId: "asc" }, { id: "asc" }],
      },
      user: { select: abandonedCartUserSelect },
    },
  },
  history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  order: { include: { customer: { select: abandonedCartCustomerSelect } } },
  user: { select: abandonedCartUserSelect },
} satisfies Prisma.CheckoutSessionInclude;

export type AbandonedCartSessionRecord = Prisma.CheckoutSessionGetPayload<{
  include: typeof abandonedCartInclude;
}>;
export type CheckoutSessionHistoryRecord = Prisma.CheckoutSessionHistoryGetPayload<Record<string, never>>;

export type AbandonedCartListItemDto = AbandonedCartItemSummary;
export type AbandonedCartDetailDto = AbandonedCartDetailResponse;
export type CheckoutSessionHistoryDto = AbandonedCartTimelineEvent;

export interface AbandonedCartMapperOptions {
  now?: Date;
  recoveryPath?: string;
  recoveryToken?: string;
}

type MapperOptionsInput = AbandonedCartMapperOptions | string | undefined;

interface FullNameParts {
  firstName: string;
  lastName: string;
}

export function toAbandonedCartListItemDto(
  session: AbandonedCartSessionRecord,
  options?: MapperOptionsInput,
): AbandonedCartListItemDto {
  void options;
  const products = mapItems(session);
  const snapshot = objectRecord(session.snapshotData);

  return {
    abandonedAt: isoDate(session.abandonedAt ?? session.lastActivityAt),
    customer: mapCustomer(session),
    id: session.id,
    ...(session.lastEmailSentAt ? { lastEmailSentAt: isoDate(session.lastEmailSentAt) } : {}),
    products,
    recoveryStatus: session.recoveryStatus,
    total: sessionTotal(snapshot, products),
  };
}

export function toAbandonedCartDetailDto(
  session: AbandonedCartSessionRecord,
  options?: MapperOptionsInput,
): AbandonedCartDetailDto {
  const listItem = toAbandonedCartListItemDto(session, options);
  const normalizedOptions = normalizeOptions(options);
  const recoveryLink = buildRecoveryLink(session, normalizedOptions);

  return {
    ...listItem,
    cartId: session.cartId,
    items: listItem.products,
    ...(session.recoveryExpiresAt ? { recoveryExpiresAt: isoDate(session.recoveryExpiresAt) } : {}),
    ...(recoveryLink ? { recoveryLink } : {}),
    timeline: mapHistoryEvents(session.history),
  };
}

export function toCheckoutSessionHistoryDto(
  history: CheckoutSessionHistoryRecord,
): CheckoutSessionHistoryDto {
  const metadata = objectRecord(history.metadata);

  return {
    ...(history.actorId ? { actorId: history.actorId } : {}),
    ...(history.actorRole ? { actorRole: history.actorRole } : {}),
    createdAt: isoDate(history.createdAt),
    eventType: history.eventType,
    id: history.id,
    ...(metadata ? { metadata: cloneJson(metadata) as Record<string, unknown> } : {}),
    ...(history.notes ? { notes: history.notes } : {}),
  };
}

export function mapHistoryEvents(
  history: readonly CheckoutSessionHistoryRecord[],
): CheckoutSessionHistoryDto[] {
  return [...history]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    .map(toCheckoutSessionHistoryDto);
}

export const mapAbandonedCartListItem = toAbandonedCartListItemDto;
export const mapAbandonedCartDetail = toAbandonedCartDetailDto;
export const mapCheckoutSessionHistory = toCheckoutSessionHistoryDto;
export const toAbandonedCartListItem = toAbandonedCartListItemDto;
export const toAbandonedCartDetail = toAbandonedCartDetailDto;

function mapItems(session: AbandonedCartSessionRecord): AbandonedCartProductSummary[] {
  const snapshotItems = snapshotItemRecords(objectRecord(session.snapshotData));
  const mappedSnapshotItems = snapshotItems.flatMap((item) => {
    const mapped = mapSnapshotItem(item);
    return mapped ? [mapped] : [];
  });

  return mappedSnapshotItems.length > 0
    ? mappedSnapshotItems
    : session.cart.items.map(mapLiveItem);
}

function mapSnapshotItem(item: Record<string, unknown>): AbandonedCartProductSummary | null {
  const nestedSnapshot = objectRecord(item["snapshot"]);
  const nestedProduct = objectRecord(item["product"]);
  const productId = textValue(item["productId"]) ?? textValue(nestedProduct?.["id"]);
  if (!productId) return null;

  const quantity = positiveInteger(item["quantity"]) ?? 1;
  const unitPrice = nonNegativeNumber(
    item["unitPrice"] ?? item["price"] ?? nestedSnapshot?.["effectivePrice"],
  ) ?? 0;
  const lineSubtotal = nonNegativeNumber(item["lineSubtotal"] ?? item["subtotal"]) ?? unitPrice * quantity;
  const name = textValue(item["name"])
    ?? textValue(item["productName"])
    ?? textValue(item["title"])
    ?? textValue(nestedSnapshot?.["name"])
    ?? textValue(nestedProduct?.["name"])
    ?? "Unknown product";

  return {
    lineSubtotal,
    name,
    productId,
    quantity,
    ...(textValue(item["sku"]) ? { sku: textValue(item["sku"]) } : {}),
    unitPrice,
    ...(textValue(item["variantId"]) ? { variantId: textValue(item["variantId"]) } : {}),
    ...(textValue(item["variantName"]) ? { variantName: textValue(item["variantName"]) } : {}),
  };
}

function mapLiveItem(item: AbandonedCartSessionRecord["cart"]["items"][number]): AbandonedCartProductSummary {
  const unitPrice = nonNegativeNumber(item.variant?.price)
    ?? nonNegativeNumber(item.product.promotionalPrice)
    ?? nonNegativeNumber(item.product.salePrice)
    ?? 0;
  const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;

  return {
    lineSubtotal: unitPrice * quantity,
    name: item.product.name,
    productId: item.productId,
    quantity,
    ...(item.variant?.sku ?? item.product.sku ? { sku: item.variant?.sku ?? item.product.sku } : {}),
    unitPrice,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    ...(item.variant?.name ? { variantName: item.variant.name } : {}),
  };
}

function mapCustomer(session: AbandonedCartSessionRecord): AbandonedCartCustomerSummary {
  const snapshot = objectRecord(session.snapshotData);
  const snapshotCustomer = objectRecord(snapshot?.["customer"])
    ?? objectRecord(snapshot?.["customerSnapshot"]);
  const candidates = [
    snapshotCustomer,
    session.user,
    session.cart?.user,
    session.order?.customer,
  ].filter((candidate): candidate is Record<string, unknown> => candidate !== null && candidate !== undefined);
  const fullNameParts = candidates.map(fullNamePartsFor).find((parts) => parts !== undefined);

  return {
    ...(firstText(candidates, ["dni", "dniOrCuil"]) ? { dni: firstText(candidates, ["dni", "dniOrCuil"]) } : {}),
    ...(firstText(candidates, ["email"]) ? { email: firstText(candidates, ["email"]) } : {}),
    firstName: firstText(candidates, ["firstName"])
      ?? fullNameParts?.firstName
      ?? "Unknown",
    lastName: firstText(candidates, ["lastName"])
      ?? fullNameParts?.lastName
      ?? "Customer",
    ...(firstText(candidates, ["phone"]) ? { phone: firstText(candidates, ["phone"]) } : {}),
  };
}

function buildRecoveryLink(
  session: AbandonedCartSessionRecord,
  options: AbandonedCartMapperOptions,
): AbandonedCartRecoveryLink | null {
  if (!session.recoveryExpiresAt || !options.recoveryToken) return null;

  const path = options.recoveryPath ?? "/checkout";
  const separator = path.includes("?") ? "&" : "?";
  return {
    expiresAt: isoDate(session.recoveryExpiresAt),
    isExpired: (options.now ?? new Date()) >= session.recoveryExpiresAt,
    url: `${path}${separator}recoveryToken=${encodeURIComponent(options.recoveryToken)}`,
  };
}

function sessionTotal(
  snapshot: Record<string, unknown> | undefined,
  products: readonly AbandonedCartProductSummary[],
): number {
  return nonNegativeNumber(snapshot?.["total"]) ?? products.reduce((total, item) => total + (item.lineSubtotal ?? item.unitPrice * item.quantity), 0);
}

function snapshotItemRecords(snapshot: Record<string, unknown> | undefined): Record<string, unknown>[] {
  const value = snapshot?.["items"] ?? snapshot?.["lineItems"];
  return Array.isArray(value) ? value.flatMap((item) => {
    const record = objectRecord(item);
    return record ? [record] : [];
  }) : [];
}

function normalizeOptions(input: MapperOptionsInput): AbandonedCartMapperOptions {
  return typeof input === "string" ? { recoveryToken: input } : input ?? {};
}

function fullNamePartsFor(record: Record<string, unknown>): FullNameParts | undefined {
  const fullName = textValue(record["fullName"]) ?? textValue(record["name"]);
  if (!fullName) return undefined;
  const [firstName, ...rest] = fullName.split(/\s+/);
  return { firstName: firstName ?? "Unknown", lastName: rest.join(" ") || "Customer" };
}

function firstText(records: readonly Record<string, unknown>[], keys: readonly string[]): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = textValue(record[key]);
      if (value) return value;
    }
  }
  return undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function cloneJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJson);
  const record = objectRecord(value);
  return record
    ? Object.fromEntries(Object.entries(record).map(([key, nested]) => [key, cloneJson(nested)]))
    : value;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number === undefined || number < 0 ? undefined : number;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim().length > 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const toString = (value as { toString: () => string }).toString();
    const number = Number(toString);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && Number.isInteger(number) && number > 0 ? number : undefined;
}

function isoDate(value: Date): string {
  return value.toISOString();
}
