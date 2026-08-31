import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ROLE } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  accountAddressInputSchema,
  accountOrderListQuerySchema,
  accountProfileUpdateSchema,
  addressIdSchema,
  type AccountAddressInput,
  type AccountOrderListQuery,
  type AccountProfileUpdateInput,
} from "./account.schemas";
import { AccountService } from "./account.service";
import {
  AccountAddressDto,
  AccountAddressRequestDto,
  AccountOrderDto,
  AccountProfileDto,
  AccountProfileRequestDto,
  AccountSuccessResponseDto,
} from "./dto/account-openapi.dto";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Account")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("account")
@Roles(ROLE.CUSTOMER)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get("profile")
  @ApiOperation({ summary: "Get the authenticated customer's profile" })
  @ApiOkResponse({ description: "Customer profile projection without secrets.", type: AccountProfileDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async profile(@Req() request: RequestWithAuthenticatedUser) {
    return this.accountService.getProfile(request.user.userId);
  }

  @Put("profile")
  @ApiOperation({ summary: "Update the authenticated customer's profile" })
  @ApiBody({ type: AccountProfileRequestDto })
  @ApiOkResponse({ description: "Updated customer profile projection.", type: AccountProfileDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async updateProfile(
    @Req() request: RequestWithAuthenticatedUser,
    @Body(new ZodValidationPipe(accountProfileUpdateSchema)) input: AccountProfileUpdateInput,
  ) {
    return this.accountService.updateProfile(request.user.userId, input);
  }

  @Get("addresses")
  @ApiOperation({ summary: "List the authenticated customer's addresses" })
  @ApiOkResponse({ description: "Customer-owned addresses.", type: [AccountAddressDto] })
  async addresses(@Req() request: RequestWithAuthenticatedUser) {
    return this.accountService.listAddresses(request.user.userId);
  }

  @Post("addresses")
  @ApiOperation({ summary: "Create an address for the authenticated customer" })
  @ApiBody({ type: AccountAddressRequestDto })
  @ApiCreatedResponse({ description: "Created customer-owned address.", type: AccountAddressDto })
  @ApiResponse({ description: "ADDRESS_LIMIT_REACHED", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async createAddress(
    @Req() request: RequestWithAuthenticatedUser,
    @Body(new ZodValidationPipe(accountAddressInputSchema)) input: AccountAddressInput,
  ) {
    return this.accountService.createAddress(request.user.userId, input);
  }

  @Put("addresses/:id")
  @ApiOperation({ summary: "Update an address owned by the authenticated customer" })
  @ApiBody({ type: AccountAddressRequestDto })
  @ApiOkResponse({ description: "Updated customer-owned address.", type: AccountAddressDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async updateAddress(
    @Req() request: RequestWithAuthenticatedUser,
    @Param("id", new ZodValidationPipe(addressIdSchema)) addressId: string,
    @Body(new ZodValidationPipe(accountAddressInputSchema)) input: AccountAddressInput,
  ) {
    return this.accountService.updateAddress(request.user.userId, addressId, input);
  }

  @Delete("addresses/:id")
  @ApiOperation({ summary: "Delete an address owned by the authenticated customer" })
  @ApiOkResponse({ description: "Address deleted.", type: AccountSuccessResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async deleteAddress(
    @Req() request: RequestWithAuthenticatedUser,
    @Param("id", new ZodValidationPipe(addressIdSchema)) addressId: string,
  ) {
    return this.accountService.deleteAddress(request.user.userId, addressId);
  }

  @Get("orders")
  @ApiOperation({ summary: "List the authenticated customer's orders" })
  @ApiOkResponse({ description: "Stable order projection; empty until Orders persistence exists.", type: [AccountOrderDto] })
  async orders(
    @Req() request: RequestWithAuthenticatedUser,
    @Query(new ZodValidationPipe(accountOrderListQuerySchema)) query: AccountOrderListQuery,
  ) {
    return this.accountService.listOrders(request.user.userId, query);
  }
}
