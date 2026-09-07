import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  STATISTICS_INTERVAL,
  STATISTICS_PERIOD,
  STATISTICS_TREND,
  type StatisticsInterval,
  type StatisticsPeriod,
  type StatisticsTrend,
} from "../statistics.schemas";

export class StatisticsQueryDto {
  @ApiPropertyOptional({ enum: Object.values(STATISTICS_PERIOD), default: STATISTICS_PERIOD.CURRENT_WEEK })
  period?: StatisticsPeriod;

  @ApiPropertyOptional({ format: "date" })
  from?: string;

  @ApiPropertyOptional({ format: "date" })
  to?: string;

  @ApiPropertyOptional({ minimum: 1 })
  limit?: number;

  @ApiPropertyOptional({ enum: Object.values(STATISTICS_INTERVAL), default: STATISTICS_INTERVAL.DAY })
  interval?: StatisticsInterval;
}

export class StatisticsWindowDto {
  @ApiProperty({ format: "date-time" }) from!: string;
  @ApiProperty({ format: "date-time" }) to!: string;
}

export class StatisticsMetadataDto {
  @ApiProperty({ enum: Object.values(STATISTICS_PERIOD), enumName: "StatisticsPeriod" }) period!: StatisticsPeriod;
  @ApiProperty({ type: StatisticsWindowDto }) window!: StatisticsWindowDto;
  @ApiProperty({ type: StatisticsWindowDto }) comparisonWindow!: StatisticsWindowDto;
}

export class StatisticsMetricDto {
  @ApiProperty() current!: number;
  @ApiProperty() previous!: number;
  @ApiProperty() variationPct!: number;
  @ApiProperty({ enum: Object.values(STATISTICS_TREND), enumName: "StatisticsTrend" }) trend!: StatisticsTrend;
}

export class StatisticsOverviewDataDto {
  @ApiProperty({ type: StatisticsMetadataDto }) metadata!: StatisticsMetadataDto;
  @ApiProperty({ type: Object, additionalProperties: { $ref: "#/components/schemas/StatisticsMetricDto" } }) metrics!: Record<string, StatisticsMetricDto>;
}

export class StatisticsPaymentStatusDto { @ApiProperty() status!: string; @ApiProperty() count!: number; }
export class StatisticsPaymentMethodDto { @ApiProperty() method!: string; @ApiProperty() revenue!: number; }
export class StatisticsShippingDto { @ApiProperty() type!: string; @ApiProperty() orders!: number; }
export class StatisticsProvinceDto { @ApiProperty() province!: string; @ApiProperty() orders!: number; @ApiProperty() revenue!: number; }

export class StatisticsSalesDataDto {
  @ApiProperty({ type: StatisticsMetadataDto }) metadata!: StatisticsMetadataDto;
  @ApiProperty({ type: Object, additionalProperties: { $ref: "#/components/schemas/StatisticsMetricDto" } }) metrics!: Record<string, StatisticsMetricDto>;
  @ApiProperty({ type: [StatisticsPaymentStatusDto] }) paymentStatuses!: StatisticsPaymentStatusDto[];
  @ApiProperty({ type: [StatisticsPaymentMethodDto] }) paymentMethods!: StatisticsPaymentMethodDto[];
  @ApiProperty({ type: [StatisticsShippingDto] }) shipping!: StatisticsShippingDto[];
  @ApiProperty({ type: [StatisticsProvinceDto] }) provinces!: StatisticsProvinceDto[];
}

export class StatisticsProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() unitsSold!: number;
  @ApiProperty() revenue!: number;
  @ApiProperty() stockAvailable!: number;
  @ApiProperty() stockReserved!: number;
}
export class StatisticsProductSeriesPointDto { @ApiProperty({ format: "date-time" }) bucket!: string; @ApiProperty() unitsSold!: number; @ApiProperty() revenue!: number; }
export class StatisticsInventoryAlertItemDto { @ApiProperty() id!: string; @ApiProperty() name!: string; @ApiProperty() stockAvailable!: number; @ApiProperty() stockReserved!: number; }
export class StatisticsInventoryAlertDto { @ApiProperty() type!: string; @ApiProperty({ type: [StatisticsInventoryAlertItemDto] }) items!: StatisticsInventoryAlertItemDto[]; }

export class StatisticsProductsDataDto {
  @ApiProperty({ type: StatisticsMetadataDto }) metadata!: StatisticsMetadataDto;
  @ApiProperty({ type: Object, additionalProperties: { $ref: "#/components/schemas/StatisticsMetricDto" } }) metrics!: Record<string, StatisticsMetricDto>;
  @ApiProperty({ type: [StatisticsProductDto] }) topProducts!: StatisticsProductDto[];
  @ApiProperty({ type: [StatisticsProductSeriesPointDto] }) series!: StatisticsProductSeriesPointDto[];
  @ApiProperty({ type: [StatisticsInventoryAlertDto] }) inventoryAlerts!: StatisticsInventoryAlertDto[];
}

export class StatisticsCustomerDto { @ApiProperty() id!: string; @ApiProperty() name!: string; @ApiProperty({ format: "email" }) email!: string; @ApiProperty() ordersCount!: number; @ApiProperty() totalSpent!: number; }
export class StatisticsCustomersDataDto {
  @ApiProperty({ type: StatisticsMetadataDto }) metadata!: StatisticsMetadataDto;
  @ApiProperty({ type: Object, additionalProperties: { $ref: "#/components/schemas/StatisticsMetricDto" } }) metrics!: Record<string, StatisticsMetricDto>;
  @ApiProperty({ type: [StatisticsCustomerDto] }) topCustomers!: StatisticsCustomerDto[];
}

export class StatisticsCouponDto { @ApiProperty() code!: string; @ApiProperty() redemptions!: number; @ApiProperty() revenue!: number; }
export class StatisticsCouponComparisonDto { @ApiProperty() orders!: number; @ApiProperty() revenue!: number; }
export class StatisticsCouponComparisonDataDto {
  @ApiProperty({ type: StatisticsCouponComparisonDto }) withCoupon!: StatisticsCouponComparisonDto;
  @ApiProperty({ type: StatisticsCouponComparisonDto }) withoutCoupon!: StatisticsCouponComparisonDto;
}
export class StatisticsCouponsDataDto {
  @ApiProperty({ type: StatisticsMetadataDto }) metadata!: StatisticsMetadataDto;
  @ApiProperty({ type: Object, additionalProperties: { $ref: "#/components/schemas/StatisticsMetricDto" } }) metrics!: Record<string, StatisticsMetricDto>;
  @ApiProperty({ type: [StatisticsCouponDto] }) topCoupons!: StatisticsCouponDto[];
  @ApiProperty({ type: StatisticsCouponComparisonDataDto }) comparison!: StatisticsCouponComparisonDataDto;
}

export class StatisticsOverviewResponseDto { @ApiProperty({ example: true }) ok!: true; @ApiProperty({ type: StatisticsOverviewDataDto }) data!: StatisticsOverviewDataDto; }
export class StatisticsSalesResponseDto { @ApiProperty({ example: true }) ok!: true; @ApiProperty({ type: StatisticsSalesDataDto }) data!: StatisticsSalesDataDto; }
export class StatisticsProductsResponseDto { @ApiProperty({ example: true }) ok!: true; @ApiProperty({ type: StatisticsProductsDataDto }) data!: StatisticsProductsDataDto; }
export class StatisticsCustomersResponseDto { @ApiProperty({ example: true }) ok!: true; @ApiProperty({ type: StatisticsCustomersDataDto }) data!: StatisticsCustomersDataDto; }
export class StatisticsCouponsResponseDto { @ApiProperty({ example: true }) ok!: true; @ApiProperty({ type: StatisticsCouponsDataDto }) data!: StatisticsCouponsDataDto; }

export { StatisticsOverviewResponseDto as OverviewStatisticsResponseDto };
export { StatisticsSalesResponseDto as SalesStatisticsResponseDto };
export { StatisticsProductsResponseDto as ProductsStatisticsResponseDto };
export { StatisticsCustomersResponseDto as CustomersStatisticsResponseDto };
export { StatisticsCouponsResponseDto as CouponsStatisticsResponseDto };
