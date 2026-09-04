import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums";

export const customerWithAddressInclude = { address: true } satisfies Prisma.CustomerInclude;
export const customerInclude = customerWithAddressInclude;

export type CustomerRecord = Prisma.CustomerGetPayload<{ include: typeof customerWithAddressInclude }>;

export type CustomerMetricValue = number | { toString(): string } | null | undefined;

export interface CustomerAddressResponseDto {
  city: string;
  country: string;
  floorOrApartment?: string;
  neighborhood?: string;
  number: string;
  postalCode: string;
  provinceOrState: string;
  street: string;
}

export interface CustomerLastOrder {
  date: string;
  id: string;
  number: string;
  total: number;
}

export interface CustomerLastOrderRecord {
  createdAt?: Date | string;
  date?: Date | string;
  id: string;
  number: string;
  total: CustomerMetricValue;
}

export interface CustomerOrderMetricRecord {
  createdAt: Date | string;
  id: string;
  number: string;
  payment?: { status: PaymentStatus } | null;
  status: OrderStatus;
  total: CustomerMetricValue;
}

export interface CustomerSalesSummary {
  lastOrder?: CustomerLastOrder;
  ordersCount: number;
  totalSpent: number;
}

export interface CustomerResponseDto {
  address?: CustomerAddressResponseDto;
  createdAt: string;
  dniOrCuil?: string;
  email: string;
  firstInteractionDate: string;
  fullName: string;
  id: string;
  isAnonymized: boolean;
  notes?: string;
  phone?: string;
  tags: string[];
  updatedAt: string;
}

export interface CustomerDetailResponseDto extends CustomerResponseDto {
  summary: CustomerSalesSummary;
}

export interface CustomerMetrics {
  lastOrder?: CustomerLastOrder | CustomerLastOrderRecord | null;
  ordersCount?: number;
  totalSpent?: CustomerMetricValue;
}

export type CustomerRecordWithMetrics = CustomerRecord & {
  lastOrder?: CustomerLastOrder | CustomerLastOrderRecord | null;
  metrics?: CustomerMetrics;
  orders?: readonly CustomerOrderMetricRecord[];
  ordersCount?: number;
  summary?: CustomerMetrics;
  totalSpent?: CustomerMetricValue;
};

export function toCustomerResponseDto(customer: CustomerRecordWithMetrics, _metrics?: CustomerMetrics): CustomerResponseDto {
  if (customer.isAnonymized) {
    return {
      createdAt: customer.createdAt.toISOString(),
      email: "",
      firstInteractionDate: customer.firstInteractionDate.toISOString(),
      fullName: `Cliente eliminado (${customer.id})`,
      id: customer.id,
      isAnonymized: true,
      tags: [...(customer.tags ?? [])],
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  return {
    ...(customer.address ? { address: toCustomerAddressDto(customer.address) } : {}),
    createdAt: customer.createdAt.toISOString(),
    ...(optionalString(customer.dniOrCuil) ? { dniOrCuil: optionalString(customer.dniOrCuil) } : {}),
    email: customer.email ?? "",
    firstInteractionDate: customer.firstInteractionDate.toISOString(),
    fullName: customer.fullName,
    id: customer.id,
    isAnonymized: false,
    ...(optionalString(customer.notes) ? { notes: optionalString(customer.notes) } : {}),
    ...(optionalString(customer.phone) ? { phone: optionalString(customer.phone) } : {}),
    tags: [...(customer.tags ?? [])],
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function toCustomerDetailResponseDto(
  customer: CustomerRecordWithMetrics,
  metrics?: CustomerMetrics,
): CustomerDetailResponseDto {
  return {
    ...toCustomerResponseDto(customer),
    summary: toCustomerSalesSummary(customer, metrics),
  };
}

export function toCustomerSalesSummary(
  customer: CustomerRecordWithMetrics,
  metrics?: CustomerMetrics,
): CustomerSalesSummary {
  const resolvedMetrics = Array.isArray(customer.orders)
    ? calculateCustomerSalesMetrics(customer)
    : metrics ?? customer.summary ?? customer.metrics ?? customer;
  const totalSpent = finiteNumber(resolvedMetrics.totalSpent);
  const ordersCount = resolvedMetrics.ordersCount ?? 0;
  if (!Number.isInteger(ordersCount) || ordersCount < 0) {
    throw new Error("Customer order metrics must be a non-negative integer.");
  }

  return {
    ...(resolvedMetrics.lastOrder ? { lastOrder: toCustomerLastOrder(resolvedMetrics.lastOrder) } : {}),
    ordersCount,
    totalSpent,
  };
}

export function calculateCustomerSalesMetrics(
  customer: Pick<CustomerRecordWithMetrics, "orders">,
): CustomerMetrics {
  const orders = (customer.orders ?? []).filter(
    (order) => order.status !== OrderStatus.CANCELLED && order.payment?.status === PaymentStatus.PAID,
  );
  const lastOrder = [...orders].sort((left, right) => {
    const dateDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return dateDifference || right.id.localeCompare(left.id);
  })[0];

  return {
    ...(lastOrder ? { lastOrder } : {}),
    ordersCount: orders.length,
    totalSpent: orders.reduce((total, order) => total + finiteNumber(order.total), 0),
  };
}

export const mapCustomer = toCustomerResponseDto;
export const mapCustomerDetail = toCustomerDetailResponseDto;
export const mapCustomerToResponseDto = toCustomerResponseDto;
export const mapCustomerToDetailResponseDto = toCustomerDetailResponseDto;

@Injectable()
export class CustomerMapper {
  toResponse(customer: CustomerRecordWithMetrics): CustomerResponseDto {
    return toCustomerResponseDto(customer);
  }

  toDetail(customer: CustomerRecordWithMetrics): CustomerDetailResponseDto {
    return toCustomerDetailResponseDto(customer);
  }
}

function toCustomerAddressDto(address: NonNullable<CustomerRecord["address"]>): CustomerAddressResponseDto {
  return {
    city: address.city,
    country: address.country,
    ...(optionalString(address.floorOrApartment) ? { floorOrApartment: optionalString(address.floorOrApartment) } : {}),
    ...(optionalString(address.neighborhood) ? { neighborhood: optionalString(address.neighborhood) } : {}),
    number: address.number,
    postalCode: address.postalCode,
    provinceOrState: address.provinceOrState,
    street: address.street,
  };
}

function toCustomerLastOrder(order: CustomerLastOrder | CustomerLastOrderRecord): CustomerLastOrder {
  const date = "date" in order ? order.date : order.createdAt;
  if (!date) throw new Error("Customer last order must include a date.");

  return {
    date: date instanceof Date ? date.toISOString() : new Date(date).toISOString(),
    id: order.id,
    number: order.number,
    total: finiteNumber(order.total),
  };
}

function optionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function finiteNumber(value: CustomerMetricValue): number {
  const result = value === null || value === undefined ? 0 : Number(value);
  if (!Number.isFinite(result)) throw new Error("Customer money metrics must serialize to finite numbers.");
  return result;
}
