import { ApiProperty } from "@nestjs/swagger";

import { HEALTH_STATUS, type HealthStatus } from "../health.service";

export class HealthResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ enum: Object.values(HEALTH_STATUS), enumName: "HealthStatus" })
  status!: HealthStatus;
}
