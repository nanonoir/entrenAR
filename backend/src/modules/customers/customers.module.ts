import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminCustomersController } from "./admin-customers.controller";
import { CustomerMapper } from "./customers.mapper";
import { CustomersRepository } from "./customers.repository";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [AdminCustomersController],
  exports: [CustomersRepository, CustomersService],
  imports: [AuthModule],
  providers: [CustomersService, CustomersRepository, CustomerMapper],
})
export class CustomersModule {}
