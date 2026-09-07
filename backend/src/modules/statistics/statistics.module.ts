import { Module } from "@nestjs/common";

import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminStatisticsController } from "./admin-statistics.controller";
import { StatisticsMapper } from "./statistics.mapper";
import { StatisticsRepository } from "./statistics.repository";
import { StatisticsService } from "./statistics.service";

@Module({
  controllers: [AdminStatisticsController],
  imports: [AuthModule, PrismaModule],
  providers: [StatisticsService, StatisticsRepository, StatisticsMapper],
})
export class StatisticsModule {}
