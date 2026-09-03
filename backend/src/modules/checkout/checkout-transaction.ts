import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type { TransactionClient } from "./checkout-cart.repository";

@Injectable()
export class CheckoutTransaction {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
