import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { MutationGate } from "./mutation-gate";

@Global()
@Module({
  exports: [PrismaService, MutationGate],
  providers: [PrismaService, MutationGate],
})
export class PrismaModule {}
