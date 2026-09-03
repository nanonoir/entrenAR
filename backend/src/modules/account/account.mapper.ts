import type { Prisma } from "../../generated/prisma/client";

import type { AccountAddress } from "./account.schemas";

export interface AccountProfileProjection {
  birthDate: string | null;
  dni: string | null;
  email: string;
  firstName: string | null;
  gender: string | null;
  lastName: string | null;
  phone: string | null;
}

export const accountProfileSelect = {
  birthDate: true,
  dni: true,
  email: true,
  firstName: true,
  gender: true,
  lastName: true,
  phone: true,
} satisfies Prisma.UserSelect;

export type AccountProfileRecord = Prisma.UserGetPayload<{ select: typeof accountProfileSelect }>;

export const accountAddressSelect = {
  city: true,
  id: true,
  label: true,
  phone: true,
  postalCode: true,
  province: true,
  recipient: true,
  street: true,
} satisfies Prisma.UserAddressSelect;

export type AccountAddressRecord = Prisma.UserAddressGetPayload<{ select: typeof accountAddressSelect }>;

export const accountOrderSelect = {
  createdAt: true,
  id: true,
  items: {
    orderBy: [{ productId: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productName: true,
      quantity: true,
      unitPrice: true,
    },
  },
  number: true,
  status: true,
  total: true,
} satisfies Prisma.OrderSelect;

export type AccountOrderRecord = Prisma.OrderGetPayload<{ select: typeof accountOrderSelect }>;

export function toAccountProfile(profile: AccountProfileRecord): AccountProfileProjection {
  return {
    birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
    dni: profile.dni,
    email: profile.email,
    firstName: profile.firstName,
    gender: profile.gender,
    lastName: profile.lastName,
    phone: profile.phone,
  };
}

export function toAccountAddress(address: AccountAddressRecord): AccountAddress {
  return {
    city: address.city,
    id: address.id,
    label: address.label,
    phone: address.phone,
    postalCode: address.postalCode,
    province: address.province,
    recipient: address.recipient,
    street: address.street,
  };
}

export function toAccountOrder(order: AccountOrderRecord): import("./account.service").AccountOrderProjection {
  return {
    date: order.createdAt.toISOString(),
    id: order.id,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      price: decimalToNumber(item.unitPrice),
      quantity: item.quantity,
    })),
    status: toAccountOrderStatus(order.status),
    total: decimalToNumber(order.total),
    trackingCode: order.number,
  };
}

function toAccountOrderStatus(status: import("../../generated/prisma/enums").OrderStatus): string {
  if (status === "CONFIRMED") return "entregado";
  if (status === "CANCELLED") return "cancelado";
  return "preparacion";
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Account order money values must serialize to finite numbers.");
  return numberValue;
}
