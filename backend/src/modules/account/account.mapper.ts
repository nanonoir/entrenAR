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
