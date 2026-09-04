import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type { PrismaClient } from "../../generated/prisma/client";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import type { CustomerListQuery } from "./customers.schemas";

const customerOrderSelect = {
  createdAt: true,
  id: true,
  number: true,
  payment: { select: { status: true } },
  status: true,
  total: true,
} as const satisfies Prisma.OrderSelect;

const customerOrderDetailSelect = {
  ...customerOrderSelect,
  items: {
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      lineSubtotal: true,
      productId: true,
      productName: true,
      quantity: true,
      sku: true,
      unitPrice: true,
      variantId: true,
      variantName: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

const customerUserSelect = {
  createdAt: true,
  dni: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  phone: true,
  role: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export const customerListInclude = {
  address: true,
  orders: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: customerOrderSelect,
  },
} satisfies Prisma.CustomerInclude;

export const customerDetailInclude = {
  address: true,
  orders: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: customerOrderDetailSelect,
  },
  user: { select: customerUserSelect },
} satisfies Prisma.CustomerInclude;

export type CustomerClient = Prisma.TransactionClient | PrismaClient;
export type CustomerAddressCreateData = Prisma.CustomerAddressCreateWithoutCustomerInput;
export type CustomerCreateData = Omit<Prisma.CustomerUncheckedCreateInput, "address"> & {
  address?: CustomerAddressCreateData | null;
};
export type CustomerUpdateData = Omit<Prisma.CustomerUncheckedUpdateInput, "address"> & {
  address?: CustomerAddressCreateData | Prisma.CustomerAddressUpdateWithoutCustomerInput | null;
};
export type CustomerListRecord = Prisma.CustomerGetPayload<{ include: typeof customerListInclude }>;
export type CustomerDetailRecord = Prisma.CustomerGetPayload<{ include: typeof customerDetailInclude }>;
export type CustomerScalarRecord = Prisma.CustomerGetPayload<Record<string, never>>;
export interface CustomerPageResult { items: CustomerListRecord[]; total: number; }
export type CustomerTagMatch = "some" | "every";
export type CustomerTagFilter =
  | string
  | readonly string[]
  | { hasEvery?: readonly string[]; hasSome?: readonly string[] };
export type CustomerRepositoryListQuery = Omit<CustomerListQuery, "sortBy"> & {
  tags?: CustomerTagFilter;
  tagsMatch?: CustomerTagMatch;
  tagsMode?: CustomerTagMatch;
  sortBy?: CustomerListQuery["sortBy"] | "name";
};

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async findMany(query: CustomerRepositoryListQuery, client?: CustomerClient): Promise<CustomerPageResult>;
  async findMany(client: CustomerClient, query: CustomerRepositoryListQuery): Promise<CustomerPageResult>;
  async findMany(first: CustomerRepositoryListQuery | CustomerClient, second?: CustomerRepositoryListQuery | CustomerClient): Promise<CustomerPageResult> {
    const { client, data: query } = resolveArgs(first, second, this.prisma);
    const where = customerWhere(query);
    const sortBy = query.sortBy ?? "createdAt";
    const metricSort = isMetricSort(sortBy);
    const skip = (query.page - 1) * query.limit;
    const [records, total] = await Promise.all([
      client.customer.findMany({
        include: customerListInclude,
        orderBy: customerOrderBy({ ...query, sortBy }),
        ...(metricSort ? {} : { skip, take: query.limit }),
        where,
      }),
      client.customer.count({ where }),
    ]);

    if (!metricSort) return { items: records, total };
    const items = [...records]
      .sort((left, right) => compareMetric(left, right, sortBy, query.sortOrder))
      .slice(skip, skip + query.limit);
    return { items, total };
  }

  async findById(id: string, client?: CustomerClient): Promise<CustomerDetailRecord | null>;
  async findById(client: CustomerClient, id: string): Promise<CustomerDetailRecord | null>;
  async findById(first: string | CustomerClient, second?: string | CustomerClient): Promise<CustomerDetailRecord | null> {
    const { client, id } = resolveIdentifier(first, second, this.prisma);
    return client.customer.findUnique({ include: customerDetailInclude, where: { id } });
  }

  async create(data: CustomerCreateData, client?: CustomerClient): Promise<CustomerListRecord>;
  async create(client: CustomerClient, data: CustomerCreateData): Promise<CustomerListRecord>;
  async create(first: CustomerCreateData | CustomerClient, second?: CustomerCreateData | CustomerClient): Promise<CustomerListRecord> {
    const { client, data } = resolveArgs(first, second, this.prisma);
    const { address, ...customerData } = data;
    return client.customer.create({
      data: {
        ...customerData,
        ...(address === undefined || address === null ? {} : { address: { create: address } }),
      },
      include: customerListInclude,
    });
  }

  async update(id: string, data: CustomerUpdateData, client?: CustomerClient): Promise<CustomerListRecord>;
  async update(client: CustomerClient, id: string, data: CustomerUpdateData): Promise<CustomerListRecord>;
  async update(first: string | CustomerClient, second: string | CustomerUpdateData, third?: CustomerUpdateData | CustomerClient): Promise<CustomerListRecord> {
    const client = isCustomerClient(first) ? first : isCustomerClient(third) ? third : this.prisma;
    const id = (isCustomerClient(first) ? second : first) as string;
    const data = (isCustomerClient(first) ? third : second) as CustomerUpdateData;
    const { address, ...customerData } = data;
    return client.customer.update({
      data: {
        ...customerData,
        ...(address === undefined
          ? {}
          : { address: address === null ? { delete: true } : { upsert: { create: address, update: address } } }),
      } as Prisma.CustomerUncheckedUpdateInput,
      include: customerListInclude,
      where: { id },
    });
  }

  async updateNotes(id: string, notes: string, client?: CustomerClient): Promise<CustomerListRecord>;
  async updateNotes(client: CustomerClient, id: string, notes: string): Promise<CustomerListRecord>;
  async updateNotes(first: string | CustomerClient, second: string, third?: string | CustomerClient): Promise<CustomerListRecord> {
    const client = isCustomerClient(first) ? first : isCustomerClient(third) ? third : this.prisma;
    const id = (isCustomerClient(first) ? second : first) as string;
    const notes = (isCustomerClient(first) ? third : second) as string;
    return client.customer.update({
      data: { notes, updatedAt: new Date() },
      include: customerListInclude,
      where: { id },
    });
  }

  async findByActiveEmail(email: string, excludeCustomerId?: string, client?: CustomerClient): Promise<CustomerScalarRecord | null>;
  async findByActiveEmail(client: CustomerClient, email: string, excludeCustomerId?: string): Promise<CustomerScalarRecord | null>;
  async findByActiveEmail(first: string | CustomerClient, second?: string, third?: string | CustomerClient): Promise<CustomerScalarRecord | null> {
    const client = isCustomerClient(first) ? first : isCustomerClient(third) ? third : this.prisma;
    const email = (isCustomerClient(first) ? second : first)?.trim().toLowerCase();
    const excludeCustomerId = (isCustomerClient(first) ? third : second) as string | undefined;
    return client.customer.findFirst({
      where: {
        email,
        isAnonymized: false,
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
      },
    });
  }
}

export function customerWhere(query: CustomerRepositoryListQuery): Prisma.CustomerWhereInput {
  const search = query.search?.trim();
  const address = {
    ...(query.country ? { country: insensitiveEquals(query.country) } : {}),
    ...(query.provinceOrState ? { provinceOrState: insensitiveEquals(query.provinceOrState) } : {}),
    ...(query.city ? { city: insensitiveEquals(query.city) } : {}),
  };
  const searchableFields = ["fullName", "email", "dniOrCuil"] as const;
  return {
    ...(search ? { OR: searchableFields.map((field) => ({ [field]: { contains: search, mode: "insensitive" as const } })) } : {}),
    ...(Object.keys(address).length > 0 ? { address: { is: address } } : {}),
    ...(query.isAnonymized === undefined ? {} : { isAnonymized: query.isAnonymized }),
    ...(query.hasOrders === undefined ? {} : { orders: query.hasOrders ? { some: {} } : { none: {} } }),
    ...tagsWhere(query.tags, query.tagsMatch ?? query.tagsMode ?? "some"),
  };
}

export function customerOrderBy(query: Pick<CustomerRepositoryListQuery, "sortBy" | "sortOrder">): Prisma.CustomerOrderByWithRelationInput[] {
  const direction = query.sortOrder ?? "desc";
  const sortBy = query.sortBy ?? "createdAt";
  if (sortBy === "ordersCount" || sortBy === "totalSpent") return [{ id: direction }];
  const field = sortBy === "name" ? "fullName" : sortBy;
  return [{ [field]: direction } as Prisma.CustomerOrderByWithRelationInput, { id: direction }];
}

function insensitiveEquals(value: string) {
  return { equals: value.trim(), mode: "insensitive" as const };
}

function tagsWhere(tags: CustomerTagFilter | undefined, match: CustomerTagMatch) {
  if (!tags) return {};
  if (isTagObject(tags)) {
    if (tags.hasEvery?.length) return { tags: { hasEvery: normalizeTags(tags.hasEvery) } };
    if (tags.hasSome?.length) return { tags: { hasSome: normalizeTags(tags.hasSome) } };
    return {};
  }
  const values = normalizeTags(typeof tags === "string" ? tags.split(",") : tags);
  return values.length === 0 ? {} : { tags: match === "every" ? { hasEvery: values } : { hasSome: values } };
}

function normalizeTags(tags: readonly string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function isTagObject(tags: CustomerTagFilter): tags is { hasEvery?: readonly string[]; hasSome?: readonly string[] } {
  return typeof tags === "object" && !Array.isArray(tags);
}

function isMetricSort(sortBy: CustomerRepositoryListQuery["sortBy"]): sortBy is "ordersCount" | "totalSpent" {
  return sortBy === "ordersCount" || sortBy === "totalSpent";
}

function compareMetric(left: CustomerListRecord, right: CustomerListRecord, sortBy: "ordersCount" | "totalSpent", direction: "asc" | "desc") {
  const difference = metricValue(left, sortBy) - metricValue(right, sortBy);
  if (difference !== 0) return direction === "asc" ? difference : -difference;
  return direction === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
}

function metricValue(customer: CustomerListRecord, sortBy: "ordersCount" | "totalSpent") {
  const orders = customer.orders.filter((order) => order.payment?.status === PaymentStatus.PAID && order.status !== OrderStatus.CANCELLED);
  return sortBy === "ordersCount" ? orders.length : orders.reduce((total, order) => total + Number(order.total), 0);
}

function isCustomerClient(value: unknown): value is CustomerClient {
  return typeof value === "object" && value !== null && "customer" in value;
}

function resolveArgs<T>(first: T | CustomerClient, second: T | CustomerClient | undefined, fallback: CustomerClient): { client: CustomerClient; data: T } {
  return isCustomerClient(first)
    ? { client: first, data: second as T }
    : { client: isCustomerClient(second) ? second : fallback, data: first };
}

function resolveIdentifier(first: string | CustomerClient, second: string | CustomerClient | undefined, fallback: CustomerClient): { client: CustomerClient; id: string } {
  return isCustomerClient(first)
    ? { client: first, id: second as string }
    : { client: isCustomerClient(second) ? second : fallback, id: first };
}
