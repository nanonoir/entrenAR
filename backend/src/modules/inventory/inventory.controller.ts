import { Body, Controller, Get, HttpStatus, Param, Put, Query, Req } from "@nestjs/common";
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
import type { Request } from "express";

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ROLE } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../auth/decorators/roles.decorator";
import { INVENTORY_ORIGIN } from "./inventory.constants";
import { InventoryRecordDto, InventoryUpdateRequestDto } from "./dto/inventory-openapi.dto";
import { InventoryService } from "./inventory.service";
import {
  inventoryHistoryQuerySchema,
  inventoryUpdateSchema,
  type InventoryHistoryQuery,
  type InventoryUpdateInput,
} from "./inventory.schemas";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@Controller("admin/inventory")
@Roles(ROLE.ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Put(":productId")
  @ApiOperation({ summary: "Apply an authoritative inventory operation to a product or variant" })
  @ApiBody({ type: InventoryUpdateRequestDto })
  @ApiOkResponse({ description: "Current inventory state after the operation.", type: InventoryRecordDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  @ApiResponse({ description: "OUT_OF_STOCK or INVALID_INVENTORY_OPERATION", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async update(
    @Param("productId") productId: string,
    @Body(new ZodValidationPipe(inventoryUpdateSchema)) input: InventoryUpdateInput,
    @Req() request: RequestWithAuthenticatedUser,
  ) {
    return this.inventoryService.update(productId, input, {
      actorId: request.user.userId,
      origin: INVENTORY_ORIGIN.ADMIN_MANUAL,
    });
  }

  @Get("history")
  @ApiOperation({ summary: "List immutable inventory history" })
  @ApiOkResponse({ description: "Paginated inventory history compatible with the CRM history view." })
  async history(
    @Query(new ZodValidationPipe(inventoryHistoryQuerySchema)) query: InventoryHistoryQuery,
  ) {
    return this.inventoryService.history(query);
  }
}
