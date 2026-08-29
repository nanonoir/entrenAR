import { Controller, Delete, Get, HttpStatus, Param, Post, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
  wishlistProductParamsSchema,
  type WishlistProductParams,
} from "./wishlist.schemas";
import { WishlistService } from "./wishlist.service";
import {
  WishlistMutationResponseDto,
  WishlistProductDto,
} from "./dto/wishlist-openapi.dto";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Wishlist")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("wishlist")
@Roles(ROLE.CUSTOMER)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated customer's public wishlist products" })
  @ApiOkResponse({ description: "Public product projections in wishlist order.", type: [WishlistProductDto] })
  async list(@Req() request: RequestWithAuthenticatedUser) {
    return this.wishlistService.list(request.user.userId);
  }

  @Post(":productId")
  @ApiOperation({ summary: "Add a visible public product to the authenticated customer's wishlist" })
  @ApiCreatedResponse({ description: "Product added to wishlist.", type: WishlistMutationResponseDto })
  @ApiConflictResponse({ description: "WISHLIST_ITEM_EXISTS", type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "PRODUCT_NOT_FOUND", type: ApiErrorResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async add(
    @Req() request: RequestWithAuthenticatedUser,
    @Param(new ZodValidationPipe(wishlistProductParamsSchema)) params: WishlistProductParams,
  ) {
    return this.wishlistService.add(request.user.userId, params.productId);
  }

  @Delete(":productId")
  @ApiOperation({ summary: "Remove a product from the authenticated customer's wishlist" })
  @ApiOkResponse({ description: "Product removed from wishlist.", type: WishlistMutationResponseDto })
  @ApiNotFoundResponse({ description: "WISHLIST_ITEM_NOT_FOUND", type: ApiErrorResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async remove(
    @Req() request: RequestWithAuthenticatedUser,
    @Param(new ZodValidationPipe(wishlistProductParamsSchema)) params: WishlistProductParams,
  ) {
    return this.wishlistService.remove(request.user.userId, params.productId);
  }
}
