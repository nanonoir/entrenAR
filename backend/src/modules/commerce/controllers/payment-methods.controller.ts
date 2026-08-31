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
  PaymentMethodConfigDto,
  PaymentMethodUpdateRequestDto,
} from "../dto/payment-method-openapi.dto";
import {
  paymentMethodUpdateSchema,
  type PaymentMethodUpdateInput,
} from "../schemas/payment.schemas";
import { PaymentService } from "../services/payment.service";

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("admin/payment-methods")
@Roles(ROLE.ADMIN)
export class PaymentMethodsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOperation({ summary: "List payment method configuration for administration" })
  @ApiOkResponse({ description: "Payment method configuration without payment-provider calls.", type: [PaymentMethodConfigDto] })
  async list() {
    return this.paymentService.list();
  }

  @Put(":providerId")
  @ApiOperation({ summary: "Update an EntrenAR-managed payment method configuration" })
  @ApiBody({ type: PaymentMethodUpdateRequestDto })
  @ApiOkResponse({ description: "Updated payment method configuration.", type: PaymentMethodConfigDto })
  @ApiResponse({ description: "INVALID_PROVIDER_OPTION or VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "INVALID_PROVIDER_OPTION", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async update(
    @Param("providerId") providerId: string,
    @Body(new ZodValidationPipe(paymentMethodUpdateSchema)) input: PaymentMethodUpdateInput,
  ) {
    return this.paymentService.update(providerId, input);
  }
}
