import { Controller, Get, HttpStatus, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  StatisticsCouponsResponseDto,
  StatisticsCustomersResponseDto,
  StatisticsOverviewResponseDto,
  StatisticsProductsResponseDto,
  StatisticsQueryDto,
  StatisticsSalesResponseDto,
} from "./dto/statistics-openapi.dto";
import { StatisticsQuerySchema, type StatisticsQuery } from "./statistics.schemas";
import { StatisticsService } from "./statistics.service";

@ApiTags("Admin Statistics")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "UNAUTHORIZED", type: ApiErrorResponseDto })
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@Controller("admin/statistics")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get overview statistics for administration" })
  @ApiQuery({ type: StatisticsQueryDto, required: false })
  @ApiOkResponse({ type: StatisticsOverviewResponseDto })
  getOverview(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery) {
    return this.statisticsService.getOverview(query);
  }

  @Get("sales")
  @ApiOperation({ summary: "Get sales statistics for administration" })
  @ApiQuery({ type: StatisticsQueryDto, required: false })
  @ApiOkResponse({ type: StatisticsSalesResponseDto })
  getSales(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery) {
    return this.statisticsService.getSales(query);
  }

  @Get("products")
  @ApiOperation({ summary: "Get product statistics for administration" })
  @ApiQuery({ type: StatisticsQueryDto, required: false })
  @ApiOkResponse({ type: StatisticsProductsResponseDto })
  getProducts(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery) {
    return this.statisticsService.getProducts(query);
  }

  @Get("customers")
  @ApiOperation({ summary: "Get customer statistics for administration" })
  @ApiQuery({ type: StatisticsQueryDto, required: false })
  @ApiOkResponse({ type: StatisticsCustomersResponseDto })
  getCustomers(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery) {
    return this.statisticsService.getCustomers(query);
  }

  @Get("coupons")
  @ApiOperation({ summary: "Get coupon statistics for administration" })
  @ApiQuery({ type: StatisticsQueryDto, required: false })
  @ApiOkResponse({ type: StatisticsCouponsResponseDto })
  getCoupons(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery) {
    return this.statisticsService.getCoupons(query);
  }
}
