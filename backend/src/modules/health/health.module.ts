import { Module } from "@nestjs/common";

import { HealthAggregateController, HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  controllers: [HealthController, HealthAggregateController],
  providers: [HealthService],
})
export class HealthModule {}
