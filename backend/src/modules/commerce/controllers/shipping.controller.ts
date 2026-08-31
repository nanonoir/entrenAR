import { Body, Controller, Get, HttpStatus, Param, Put } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../../../common/errors/api-error-response.dto";
import { ROLE } from "../../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  ShippingProviderDto,
  ShippingProviderRequestDto,
} from "../dto/shipping-openapi.dto";
import {
  shippingProviderUpdateSchema,
  type ShippingProviderUpdateInput,
} from "../schemas/shipping.schemas";
import { ShippingService } from "../services/shipping.service";

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("admin/shipping")
@Roles(ROLE.ADMIN)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get("providers")
  @ApiOperation({ summary: "List shipping provider configuration for administration" })
  @ApiOkResponse({ description: "EntrenAR-managed shipping provider configuration.", type: [ShippingProviderDto] })
  async providers() {
    return this.shippingService.listProviders();
  }

  @Put("providers/:providerId")
  @ApiOperation({ summary: "Update shipping provider costs and settings" })
  @ApiBody({ type: ShippingProviderRequestDto })
  @ApiOkResponse({ description: "Updated shipping provider configuration.", type: ShippingProviderDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "INVALID_PROVIDER_STATUS or INVALID_WEIGHT_RANGE", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async updateProvider(
    @Param("providerId") providerId: string,
    @Body(new ZodValidationPipe(shippingProviderUpdateSchema)) input: ShippingProviderUpdateInput,
  ) {
    return this.shippingService.updateProvider(providerId, input);
  }
}
