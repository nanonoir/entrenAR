import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import {
  ACCOUNT_ADDRESS_CREATION_STATUS,
  AccountRepository,
} from "./account.repository";
import {
  toAccountAddress,
  toAccountProfile,
  type AccountProfileProjection,
} from "./account.mapper";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountOrderListQuery,
  AccountProfileUpdateInput,
} from "./account.schemas";

export interface AccountOrderItemProjection {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface AccountOrderProjection {
  date: string;
  id: string;
  items: AccountOrderItemProjection[];
  status: string;
  total: number;
  trackingCode: string;
}

export interface AccountSuccess {
  ok: true;
}

@Injectable()
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async getProfile(userId: string): Promise<AccountProfileProjection> {
    const profile = await this.accountRepository.findProfileByUserId(userId);

    if (!profile) {
      throw this.notFound("The requested account profile was not found.");
    }

    return toAccountProfile(profile);
  }

  async updateProfile(userId: string, input: AccountProfileUpdateInput): Promise<AccountProfileProjection> {
    const profile = await this.accountRepository.updateProfile(userId, input);

    if (!profile) {
      throw this.notFound("The requested account profile was not found.");
    }

    return toAccountProfile(profile);
  }

  async listAddresses(userId: string): Promise<AccountAddress[]> {
    const addresses = await this.accountRepository.listAddresses(userId);

    return addresses.map(toAccountAddress);
  }

  async createAddress(userId: string, input: AccountAddressInput): Promise<AccountAddress> {
    const result = await this.accountRepository.createAddress(userId, input);

    if (result.status === ACCOUNT_ADDRESS_CREATION_STATUS.LIMIT_REACHED) {
      throw new ConflictException({
        code: ERROR_CODE.ADDRESS_LIMIT_REACHED,
        message: "An account cannot have more than six addresses.",
        ok: false,
      });
    }

    if (result.status === ACCOUNT_ADDRESS_CREATION_STATUS.USER_NOT_FOUND) {
      throw this.notFound("The requested account profile was not found.");
    }

    return toAccountAddress(result.address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: AccountAddressInput,
  ): Promise<AccountAddress> {
    const address = await this.accountRepository.updateAddress(userId, addressId, input);

    if (!address) {
      throw this.notFound("The requested account address was not found.");
    }

    return toAccountAddress(address);
  }

  async deleteAddress(userId: string, addressId: string): Promise<AccountSuccess> {
    const deleted = await this.accountRepository.deleteAddress(userId, addressId);

    if (!deleted) {
      throw this.notFound("The requested account address was not found.");
    }

    return { ok: true };
  }

  async listOrders(
    userId: string,
    query: AccountOrderListQuery,
  ): Promise<AccountOrderProjection[]> {
    void userId;
    void query;
    return [];
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.NOT_FOUND,
      message,
      ok: false,
    });
  }
}
