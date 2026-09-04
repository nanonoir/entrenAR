import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminSuppliersController } from "./admin-suppliers.controller";
import { SuppliersRepository } from "./suppliers.repository";
import { SuppliersService } from "./suppliers.service";

@Module({
  controllers: [AdminSuppliersController],
  exports: [SuppliersRepository, SuppliersService],
  imports: [AuthModule],
  providers: [SuppliersRepository, SuppliersService],
})
export class SuppliersModule {}
