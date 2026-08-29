import { Module } from "@nestjs/common";

import { AccountController } from "./account.controller";
import { AccountRepository } from "./account.repository";
import { AccountService } from "./account.service";

@Module({
  controllers: [AccountController],
  exports: [AccountService],
  providers: [AccountRepository, AccountService],
})
export class AccountModule {}
