import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { MutationGate } from "../../common/prisma/mutation-gate";
import { Prisma } from "../../generated/prisma/client";
import type { TransactionClient } from "./checkout-cart.repository";

@Injectable()
export class CheckoutTransaction {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationGate = new MutationGate(),
  ) {}

  async run<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.mutationGate.runShared(this.prisma, callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
