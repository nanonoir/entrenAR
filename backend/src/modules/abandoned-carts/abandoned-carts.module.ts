import { Module } from "@nestjs/common";

import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminAbandonedCartsController } from "./admin-abandoned-carts.controller";
import { AbandonedCartsRepository } from "./abandoned-carts.repository";
import { AbandonedCartsService } from "./abandoned-carts.service";

@Module({
  controllers: [AdminAbandonedCartsController],
  exports: [AbandonedCartsRepository, AbandonedCartsService],
  imports: [AuthModule, PrismaModule],
  providers: [AbandonedCartsRepository, AbandonedCartsService],
})
export class AbandonedCartsModule {}
