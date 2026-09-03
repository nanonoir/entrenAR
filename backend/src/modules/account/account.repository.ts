import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  ACCOUNT_MAX_ADDRESSES,
  type AccountProfileUpdateInput,
  type AccountAddressInput,
} from "./account.schemas";
import {
  accountAddressSelect,
  accountOrderSelect,
  accountProfileSelect,
  type AccountAddressRecord,
  type AccountOrderRecord,
  type AccountProfileRecord,
} from "./account.mapper";

export const ACCOUNT_ADDRESS_CREATION_STATUS = {
  CREATED: "created",
  LIMIT_REACHED: "limit-reached",
  USER_NOT_FOUND: "user-not-found",
} as const;

export interface CreatedAccountAddressResult {
  address: AccountAddressRecord;
  status: typeof ACCOUNT_ADDRESS_CREATION_STATUS.CREATED;
}

export interface AddressLimitReachedResult {
  status: typeof ACCOUNT_ADDRESS_CREATION_STATUS.LIMIT_REACHED;
}

export interface AccountUserNotFoundResult {
  status: typeof ACCOUNT_ADDRESS_CREATION_STATUS.USER_NOT_FOUND;
}

export type CreateAccountAddressResult =
  | CreatedAccountAddressResult
  | AddressLimitReachedResult
  | AccountUserNotFoundResult;

type TransactionClient = Prisma.TransactionClient;

interface LockedAccountUser {
  id: string;
}

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProfileByUserId(userId: string): Promise<AccountProfileRecord | null> {
    return this.prisma.user.findUnique({
      select: accountProfileSelect,
      where: { id: userId },
    });
  }

  async updateProfile(userId: string, input: AccountProfileUpdateInput): Promise<AccountProfileRecord | null> {
    try {
      return await this.prisma.user.update({
        data: {
          birthDate: new Date(input.birthDate),
          dni: input.dni,
          firstName: input.firstName,
          gender: input.gender,
          lastName: input.lastName,
          phone: input.phone,
        },
        select: accountProfileSelect,
        where: { id: userId },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async listAddresses(userId: string): Promise<AccountAddressRecord[]> {
    return this.prisma.userAddress.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: accountAddressSelect,
      where: { userId },
    });
  }

  async listOrders(userId: string, skip: number, take: number): Promise<AccountOrderRecord[]> {
    return this.prisma.order.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: accountOrderSelect,
      skip,
      take,
      where: { userId },
    });
  }

  async createAddress(userId: string, input: AccountAddressInput): Promise<CreateAccountAddressResult> {
    return this.prisma.$transaction(
      async (transaction) => this.createAddressInTransaction(transaction, userId, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: AccountAddressInput,
  ): Promise<AccountAddressRecord | null> {
    try {
      return await this.prisma.userAddress.update({
        data: input,
        select: accountAddressSelect,
        where: { id: addressId, userId },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const result = await this.prisma.userAddress.deleteMany({
      where: { id: addressId, userId },
    });

    return result.count === 1;
  }

  private async createAddressInTransaction(
    transaction: TransactionClient,
    userId: string,
    input: AccountAddressInput,
  ): Promise<CreateAccountAddressResult> {
    // Lock the owning user so the count-and-create sequence is atomic per account.
    const users = await transaction.$queryRaw<LockedAccountUser[]>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    );

    if (users.length === 0) {
      return { status: ACCOUNT_ADDRESS_CREATION_STATUS.USER_NOT_FOUND };
    }

    const addressCount = await transaction.userAddress.count({ where: { userId } });

    if (addressCount >= ACCOUNT_MAX_ADDRESSES) {
      return { status: ACCOUNT_ADDRESS_CREATION_STATUS.LIMIT_REACHED };
    }

    const address = await transaction.userAddress.create({
      data: { ...input, userId },
      select: accountAddressSelect,
    });

    return {
      address,
      status: ACCOUNT_ADDRESS_CREATION_STATUS.CREATED,
    };
  }
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
