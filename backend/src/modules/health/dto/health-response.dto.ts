import { ApiProperty } from "@nestjs/swagger";

import {
  DATABASE_STATUS,
  HEALTH_STATUS,
  type DatabaseStatus,
  type HealthStatus,
} from "../health.service";

export class HealthResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ enum: Object.values(HEALTH_STATUS), enumName: "HealthStatus" })
  status!: HealthStatus;
}

export class AggregateHealthResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ enum: [HEALTH_STATUS.OK], example: HEALTH_STATUS.OK })
  status!: typeof HEALTH_STATUS.OK;

  @ApiProperty({ example: "2026-09-07T12:00:00.000Z", format: "date-time" })
  timestamp!: string;

  @ApiProperty({ example: 42.75, description: "Process uptime in seconds." })
  uptime!: number;

  @ApiProperty({ enum: Object.values(DATABASE_STATUS), enumName: "DatabaseStatus", example: DATABASE_STATUS.UP })
  database!: DatabaseStatus;
}
