import { Body, Controller, Get, HttpStatus, Param, Put } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../../../common/errors/api-error-response.dto";
import { ROLE } from "../../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Roles } from "../../auth/decorators/roles.decorator";
import { PickupPointDto, PickupPointRequestDto } from "../dto/shipping-openapi.dto";
import {
  pickupPointUpdateSchema,
  type PickupPointUpdateInput,
} from "../schemas/shipping.schemas";
import { ShippingService } from "../services/shipping.service";

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("admin/pickup-points")
@Roles(ROLE.ADMIN)
export class PickupPointsController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({ summary: "List pickup points for administration" })
  @ApiOkResponse({ description: "Pickup points with safe configuration projections.", type: [PickupPointDto] })
  async list() {
    return this.shippingService.listPickupPoints();
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a pickup point and its schedule" })
  @ApiBody({ type: PickupPointRequestDto })
  @ApiOkResponse({ description: "Updated pickup point.", type: PickupPointDto })
  @ApiResponse({ description: "INVALID_PICKUP_CONFIGURATION", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "PICKUP_SCHEDULE_OVERLAP", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(pickupPointUpdateSchema)) input: PickupPointUpdateInput,
  ) {
    return this.shippingService.updatePickupPoint(id, input);
  }
}
