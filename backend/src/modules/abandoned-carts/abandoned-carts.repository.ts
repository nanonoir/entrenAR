import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CartStatus, CheckoutRecoveryStatus, CheckoutSessionStatus } from "../../generated/prisma/enums";
import {
  ABANDONED_CART_SORT_BY,
  ABANDONED_CART_SORT_ORDER,
  type AbandonedCartListQuery,
  type AbandonedCartSortBy,
  type AbandonedCartSortOrder,
  type RecoveryStatus,
} from "./abandoned-carts.schemas";
import { abandonedCartInclude, type AbandonedCartSessionRecord, type CheckoutSessionHistoryRecord } from "./abandoned-carts.mapper";

const SETTINGS_ID = "singleton";
const DEFAULT_SETTINGS = {
  emailHtmlBody: "<p>Hola {{nombre}},</p><p>Vimos que dejaste productos en tu carrito.</p><p><a href=\"{{checkoutUrl}}\">Volver a mi carrito</a></p>",
  emailPlainBody: "Hola {{nombre}},\n\nVimos que dejaste productos en tu carrito.\n\nVolver a mi carrito: {{checkoutUrl}}",
  emailSubject: "Te guardamos tu carrito en EntrenAR",
  id: SETTINGS_ID,
  isActive: true,
  timing: "24hs",
} as const;

export type TransactionClient = Prisma.TransactionClient;
export type AbandonedCartsClient = PrismaService | TransactionClient;

export interface AbandonedCartDateRange {
  from?: Date;
  to?: Date;
}

export interface AbandonedCartTotalRange {
  max?: number;
  min?: number;
}

export interface AbandonedCartFilters {
  abandonedAt?: AbandonedCartDateRange;
  abandonedBefore?: Date;
  abandonmentThresholdMs?: number;
  dateRange?: AbandonedCartDateRange;
  from?: Date;
  includeActiveStale?: boolean;
  maxTotal?: number;
  minTotal?: number;
  now?: Date;
  search?: string;
  status?: CheckoutRecoveryStatus | RecoveryStatus | string;
  to?: Date;
  totalRange?: AbandonedCartTotalRange;
}

export interface AbandonedCartPageInput {
  limit: number;
  page: number;
}

export interface AbandonedCartSort {
  direction?: AbandonedCartSortOrder;
  field?: AbandonedCartSortBy;
  sortBy?: AbandonedCartSortBy;
  sortOrder?: AbandonedCartSortOrder;
}

export interface AbandonedCartMetrics {
  pendingCount: number;
  recoverableTotal: number;
  recoveredCount: number;
}

export interface AbandonedCartPageResult {
  items: AbandonedCartSessionRecord[];
  metrics: AbandonedCartMetrics;
  total: number;
}

export interface CartRecoverySettingsUpdate {
  emailHtmlBody?: string;
  emailPlainBody?: string;
  emailSubject?: string;
  htmlBody?: string;
  isActive?: boolean;
  plainTextBody?: string;
  subject?: string;
  timing?: string;
}

export interface RecoveryStatusUpdateOptions {
  completedAt?: Date;
  sessionStatus?: CheckoutSessionStatus;
}

export type CartRecoverySettingsRecord = Prisma.CartRecoverySettingsGetPayload<Record<string, never>>;

@Injectable()
export class AbandonedCartsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: AbandonedCartListQuery): Promise<AbandonedCartPageResult>;
  async findMany(filters: AbandonedCartFilters, pagination: AbandonedCartPageInput, sort?: AbandonedCartSort): Promise<AbandonedCartPageResult>;
  async findMany(
    first: AbandonedCartFilters | AbandonedCartListQuery,
    pagination?: AbandonedCartPageInput,
    sort?: AbandonedCartSort,
  ): Promise<AbandonedCartPageResult> {
    const args = resolveFindManyArgs(first, pagination, sort);
    const where = abandonedCartWhere(args.filters);
    const sortBy = args.sort.sortBy ?? args.sort.field ?? ABANDONED_CART_SORT_BY.ABANDONED_AT;
    const sortOrder = args.sort.sortOrder ?? args.sort.direction ?? ABANDONED_CART_SORT_ORDER.DESC;
    const customSort = sortBy === ABANDONED_CART_SORT_BY.CUSTOMER_NAME || sortBy === ABANDONED_CART_SORT_BY.TOTAL;
    const skip = (args.pagination.page - 1) * args.pagination.limit;
    const orderBy = abandonedCartOrderBy({ sortBy, sortOrder });

    const recordsPromise = customSort
      ? this.prisma.checkoutSession.findMany({ include: abandonedCartInclude, orderBy: [{ id: sortOrder }], where })
      : this.prisma.checkoutSession.findMany({ include: abandonedCartInclude, orderBy, skip, take: args.pagination.limit, where });
    const [records, total, pendingCount, recoveredCount, recoverableRecords] = await Promise.all([
      recordsPromise as Promise<AbandonedCartSessionRecord[]>,
      this.prisma.checkoutSession.count({ where }),
      this.prisma.checkoutSession.count({ where: withRecoveryStatus(where, CheckoutRecoveryStatus.PENDING) }),
      this.prisma.checkoutSession.count({ where: withRecoveryStatus(where, CheckoutRecoveryStatus.RECOVERED) }),
      this.prisma.checkoutSession.findMany({
        select: { snapshotData: true },
        where: withRecoveryStatuses(where, [CheckoutRecoveryStatus.PENDING, CheckoutRecoveryStatus.SENT, CheckoutRecoveryStatus.MANUAL]),
      }),
    ]);

    const items = customSort
      ? sortRecords(records, sortBy, sortOrder).slice(skip, skip + args.pagination.limit)
      : records;
    const metricRecords = recoverableRecords ?? [];
    return {
      items,
      metrics: {
        pendingCount: pendingCount ?? 0,
        recoverableTotal: metricRecords.reduce((totalValue, record) => totalValue + snapshotTotal(record.snapshotData), 0),
        recoveredCount: recoveredCount ?? 0,
      },
      total: total ?? 0,
    };
  }

  async findById(id: string, client: AbandonedCartsClient = this.prisma): Promise<AbandonedCartSessionRecord | null> {
    return client.checkoutSession.findUnique({ include: abandonedCartInclude, where: { id } });
  }

  async updateRecoveryStatus(
    id: string,
    targetStatus: CheckoutRecoveryStatus,
    txClient?: TransactionClient,
    options: RecoveryStatusUpdateOptions = {},
  ): Promise<AbandonedCartSessionRecord> {
    if (!txClient) return this.runInTransaction((transaction) => this.updateRecoveryStatus(id, targetStatus, transaction, options));
    return txClient.checkoutSession.update({
      data: {
        ...(options.completedAt ? { completedAt: options.completedAt, lastActivityAt: options.completedAt } : {}),
        recoveryStatus: targetStatus,
        ...(options.sessionStatus ? { status: options.sessionStatus } : {}),
      },
      include: abandonedCartInclude,
      where: { id },
    });
  }

  async updateRecoveryEmailSent(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    lastEmailSentAt: Date,
    txClient?: TransactionClient,
  ): Promise<AbandonedCartSessionRecord> {
    if (!txClient) return this.runInTransaction((transaction) => this.updateRecoveryEmailSent(id, tokenHash, expiresAt, lastEmailSentAt, transaction));
    return txClient.checkoutSession.update({
      data: {
        lastEmailSentAt,
        recoveryExpiresAt: expiresAt,
        recoveryStatus: CheckoutRecoveryStatus.SENT,
        recoveryTokenHash: tokenHash,
      },
      include: abandonedCartInclude,
      where: { id },
    });
  }

  async appendHistoryEvent(
    sessionId: string,
    eventType: string,
    actorId?: string,
    actorRole?: string,
    notes?: string,
    metadata?: unknown,
    txClient?: TransactionClient,
  ): Promise<CheckoutSessionHistoryRecord> {
    if (!txClient) return this.runInTransaction((transaction) => this.appendHistoryEvent(sessionId, eventType, actorId, actorRole, notes, metadata, transaction));
    return txClient.checkoutSessionHistory.create({
      data: {
        actorId: actorId ?? null,
        actorRole: actorRole ?? null,
        checkoutSessionId: sessionId,
        eventType,
        metadata: toJsonValue(metadata),
        notes: notes ?? null,
      },
    });
  }

  async getSettings(client: AbandonedCartsClient = this.prisma): Promise<CartRecoverySettingsRecord> {
    const settings = await client.cartRecoverySettings.findUnique({ where: { id: SETTINGS_ID } });
    return settings ?? client.cartRecoverySettings.create({ data: DEFAULT_SETTINGS });
  }

  async updateSettings(data: CartRecoverySettingsUpdate, client: AbandonedCartsClient = this.prisma): Promise<CartRecoverySettingsRecord> {
    return client.cartRecoverySettings.update({ data: settingsUpdateData(data), where: { id: SETTINGS_ID } });
  }

  async runInTransaction<T>(fn: (txClient: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}

export function abandonedCartWhere(filters: AbandonedCartFilters = {}): Prisma.CheckoutSessionWhereInput {
  const from = filters.from ?? filters.abandonedAt?.from ?? filters.dateRange?.from;
  const to = filters.to ?? filters.abandonedAt?.to ?? filters.dateRange?.to;
  const minTotal = filters.minTotal ?? filters.totalRange?.min;
  const maxTotal = filters.maxTotal ?? filters.totalRange?.max;
  const branches: Prisma.CheckoutSessionWhereInput[] = [
    { status: CheckoutSessionStatus.ABANDONED },
    { cart: { is: { status: CartStatus.ABANDONED } } },
  ];
  const abandonedBefore = filters.abandonedBefore
    ?? (filters.includeActiveStale || filters.abandonmentThresholdMs !== undefined
      ? new Date((filters.now ?? new Date()).getTime() - (filters.abandonmentThresholdMs ?? 0))
      : undefined);

  if (abandonedBefore) {
    branches.push({
      OR: [
        { cart: { is: { items: { some: {} } } } },
        { userId: { not: null } },
      ],
      lastActivityAt: { lt: abandonedBefore },
      status: CheckoutSessionStatus.ACTIVE,
    });
  }

  const where: Prisma.CheckoutSessionWhereInput = {
    OR: branches,
    ...(filters.status ? { recoveryStatus: normalizeRecoveryStatus(filters.status) } : {}),
    ...(from || to ? { abandonedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(minTotal !== undefined || maxTotal !== undefined
      ? { snapshotData: { path: ["total"], ...(minTotal !== undefined ? { gte: minTotal } : {}), ...(maxTotal !== undefined ? { lte: maxTotal } : {}) } }
      : {}),
  };
  const search = filters.search?.trim();
  if (search) {
    where.AND = [{
      OR: [
        { id: { contains: search, mode: "insensitive" } },
        { user: { is: { OR: personSearch(search) } } },
        { cart: { is: { user: { is: { OR: personSearch(search) } } } } },
        { order: { is: { customer: { is: { OR: customerSearch(search) } } } } },
        ...snapshotSearch(search),
      ],
    }];
  }
  return where;
}

export function abandonedCartOrderBy(sort: AbandonedCartSort = {}): Prisma.CheckoutSessionOrderByWithRelationInput[] {
  const sortBy = sort.sortBy ?? sort.field ?? ABANDONED_CART_SORT_BY.ABANDONED_AT;
  const direction = sort.sortOrder ?? sort.direction ?? ABANDONED_CART_SORT_ORDER.DESC;
  if (sortBy === ABANDONED_CART_SORT_BY.CUSTOMER_NAME) {
    return [{ user: { lastName: direction } }, { user: { firstName: direction } }, { id: direction }];
  }
  if (sortBy === ABANDONED_CART_SORT_BY.TOTAL) return [{ id: direction }];
  return [{ [sortBy]: direction } as Prisma.CheckoutSessionOrderByWithRelationInput, { id: direction }];
}

function resolveFindManyArgs(
  first: AbandonedCartFilters | AbandonedCartListQuery,
  pagination: AbandonedCartPageInput | undefined,
  sort: AbandonedCartSort | undefined,
): { filters: AbandonedCartFilters; pagination: AbandonedCartPageInput; sort: AbandonedCartSort } {
  if (!pagination && "page" in first && "limit" in first) {
    const query = first as AbandonedCartListQuery;
    return {
      filters: query,
      pagination: { limit: query.limit, page: query.page },
      sort: { sortBy: query.sortBy, sortOrder: query.sortOrder },
    };
  }
  return {
    filters: first,
    pagination: pagination ?? { limit: 20, page: 1 },
    sort: sort ?? {},
  };
}

function normalizeRecoveryStatus(value: CheckoutRecoveryStatus | RecoveryStatus | string): CheckoutRecoveryStatus {
  return value.toUpperCase() as CheckoutRecoveryStatus;
}

function withRecoveryStatus(
  where: Prisma.CheckoutSessionWhereInput,
  status: CheckoutRecoveryStatus,
): Prisma.CheckoutSessionWhereInput {
  return { AND: [where, { recoveryStatus: status }] };
}

function withRecoveryStatuses(
  where: Prisma.CheckoutSessionWhereInput,
  statuses: readonly CheckoutRecoveryStatus[],
): Prisma.CheckoutSessionWhereInput {
  return { AND: [where, { recoveryStatus: { in: [...statuses] } }] };
}

function sortRecords(
  records: readonly AbandonedCartSessionRecord[],
  sortBy: AbandonedCartSortBy,
  sortOrder: AbandonedCartSortOrder,
): AbandonedCartSessionRecord[] {
  return [...records].sort((left, right) => {
    const leftValue = sortBy === ABANDONED_CART_SORT_BY.TOTAL ? snapshotTotal(left.snapshotData) : customerName(left);
    const rightValue = sortBy === ABANDONED_CART_SORT_BY.TOTAL ? snapshotTotal(right.snapshotData) : customerName(right);
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    if (comparison !== 0) return sortOrder === ABANDONED_CART_SORT_ORDER.ASC ? comparison : -comparison;
    return sortOrder === ABANDONED_CART_SORT_ORDER.ASC ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
  });
}

function customerName(session: AbandonedCartSessionRecord): string {
  const snapshot = objectRecord(session.snapshotData);
  const customer = objectRecord(snapshot?.["customer"]);
  const firstName = textValue(customer?.["firstName"]) ?? session.user?.firstName ?? "";
  const lastName = textValue(customer?.["lastName"]) ?? session.user?.lastName ?? "";
  return `${lastName} ${firstName}`.trim().toLocaleLowerCase();
}

function snapshotTotal(value: unknown): number {
  const snapshot = objectRecord(value);
  const total = snapshot?.["total"];
  if (typeof total === "number" && Number.isFinite(total) && total >= 0) return total;
  if (typeof total === "string" && Number.isFinite(Number(total)) && Number(total) >= 0) return Number(total);
  return 0;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function personSearch(search: string): Prisma.UserWhereInput[] {
  return [
    { email: { contains: search, mode: "insensitive" } },
    { firstName: { contains: search, mode: "insensitive" } },
    { lastName: { contains: search, mode: "insensitive" } },
  ];
}

function customerSearch(search: string): Prisma.CustomerWhereInput[] {
  return [
    { email: { contains: search, mode: "insensitive" } },
    { fullName: { contains: search, mode: "insensitive" } },
    { dniOrCuil: { contains: search, mode: "insensitive" } },
  ];
}

function snapshotSearch(search: string): Prisma.CheckoutSessionWhereInput[] {
  return ["firstName", "lastName", "email"].map((field) => ({
    snapshotData: { path: ["customer", field], mode: "insensitive", string_contains: search },
  }));
}

function settingsUpdateData(data: CartRecoverySettingsUpdate): Prisma.CartRecoverySettingsUpdateInput {
  const emailSubject = data.emailSubject ?? data.subject;
  const emailHtmlBody = data.emailHtmlBody ?? data.htmlBody;
  const emailPlainBody = data.emailPlainBody ?? data.plainTextBody;
  return {
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    ...(data.timing === undefined ? {} : { timing: data.timing }),
    ...(emailSubject === undefined ? {} : { emailSubject }),
    ...(emailHtmlBody === undefined ? {} : { emailHtmlBody }),
    ...(emailPlainBody === undefined ? {} : { emailPlainBody }),
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return {};
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return {};
  const parsed: unknown = JSON.parse(serialized);
  return (parsed === null ? {} : parsed) as Prisma.InputJsonValue;
}
