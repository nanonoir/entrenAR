import { Injectable } from "@nestjs/common";

import { MutationGate } from "../../common/prisma/mutation-gate";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";

/** Short ReadCommitted transactions; provider HTTP calls must never run inside them. */
@Injectable()
export class PaymentsTransaction {
  private readonly mutationGate = new MutationGate();

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.mutationGate.runShared(this.prisma, callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}

/** Current database time, used for retry windows so app-server clock skew never extends them. */
export async function databaseNow(transaction: Prisma.TransactionClient): Promise<Date> {
  const rows = await transaction.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
  const now = rows[0]?.now;
  if (!now) throw new Error("Database time could not be read.");
  return now;
}

export async function lockOrderAndPayment(
  transaction: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
  await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "OrderPayment" WHERE "orderId" = ${orderId} FOR UPDATE`);
}
