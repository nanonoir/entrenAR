import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Req } from "@nestjs/common";
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

import type { AccessTokenPayload } from "../../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../../common/errors/api-error-response.dto";
import { ROLE } from "../../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CouponDto,
  CouponRequestDto,
  ShippingDiscountDto,
  ShippingDiscountRequestDto,
} from "../dto/discount-openapi.dto";
import {
  couponRequestSchema,
  shippingDiscountRequestSchema,
  type CouponInput,
  type ShippingDiscountInput,
} from "../schemas/discount.schemas";
import { DiscountService } from "../services/discount.service";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("admin/discounts")
@Roles(ROLE.ADMIN)
export class DiscountsController {
  constructor(private readonly discountService: DiscountService) {}

  @Get("coupons")
  @ApiOperation({ summary: "List active coupon configuration" })
  @ApiOkResponse({ description: "Active coupons with relational configuration history.", type: [CouponDto] })
  async coupons() {
    return this.discountService.listCoupons();
  }

  @Post("coupons")
  @ApiOperation({ summary: "Create a coupon configuration" })
  @ApiBody({ type: CouponRequestDto })
  @ApiCreatedResponse({ description: "Created coupon configuration.", type: CouponDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "COUPON_CODE_ALREADY_EXISTS", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async createCoupon(
    @Req() request: RequestWithAuthenticatedUser,
    @Body(new ZodValidationPipe(couponRequestSchema)) input: CouponInput,
  ) {
    return this.discountService.createCoupon(input, request.user.userId);
  }

  @Put("coupons/:id")
  @ApiOperation({ summary: "Update a coupon configuration" })
  @ApiBody({ type: CouponRequestDto })
  @ApiOkResponse({ description: "Updated coupon configuration.", type: CouponDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "COUPON_CODE_ALREADY_EXISTS", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async updateCoupon(
    @Req() request: RequestWithAuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(couponRequestSchema)) input: CouponInput,
  ) {
    return this.discountService.updateCoupon(id, input, request.user.userId);
  }

  @Delete("coupons/:id")
  @ApiOperation({ summary: "Archive a coupon configuration" })
  @ApiOkResponse({ description: "Coupon archived." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async deleteCoupon(@Param("id") id: string) {
    return this.discountService.deleteCoupon(id);
  }

  @Get("shipping")
  @ApiOperation({ summary: "List active automatic shipping discounts" })
  @ApiOkResponse({ description: "Active automatic shipping discounts.", type: [ShippingDiscountDto] })
  async shippingDiscounts() {
    return this.discountService.listShippingDiscounts();
  }

  @Post("shipping")
  @ApiOperation({ summary: "Create an automatic shipping discount" })
  @ApiBody({ type: ShippingDiscountRequestDto })
  @ApiCreatedResponse({ description: "Created automatic shipping discount.", type: ShippingDiscountDto })
  @ApiResponse({ description: "INVALID_SHIPPING_METHOD or VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "INVALID_SHIPPING_METHOD", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async createShippingDiscount(
    @Body(new ZodValidationPipe(shippingDiscountRequestSchema)) input: ShippingDiscountInput,
  ) {
    return this.discountService.createShippingDiscount(input);
  }

  @Put("shipping/:id")
  @ApiOperation({ summary: "Update an automatic shipping discount" })
  @ApiBody({ type: ShippingDiscountRequestDto })
  @ApiOkResponse({ description: "Updated automatic shipping discount.", type: ShippingDiscountDto })
  @ApiResponse({ description: "INVALID_SHIPPING_METHOD or VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async updateShippingDiscount(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(shippingDiscountRequestSchema)) input: ShippingDiscountInput,
  ) {
    return this.discountService.updateShippingDiscount(id, input);
  }

  @Delete("shipping/:id")
  @ApiOperation({ summary: "Archive an automatic shipping discount" })
  @ApiOkResponse({ description: "Shipping discount archived." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async deleteShippingDiscount(@Param("id") id: string) {
    return this.discountService.deleteShippingDiscount(id);
  }
}
