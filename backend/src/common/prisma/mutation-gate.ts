import { Injectable } from "@nestjs/common";

import { Prisma, PrismaClient } from "../../generated/prisma/client";

export const MUTATION_GATE_LOCK_KEY = 847_291_643;
export const MUTATION_GATE_LOCK_TIMEOUT = "10s";
export const MUTATION_GATE_TRANSACTION_TIMEOUT_MS = 12_000;

type TransactionCallback<T> = (transaction: Prisma.TransactionClient) => Promise<T>;

interface MutationTransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
}

@Injectable()
export class MutationGate {
  async runShared<T>(
    prisma: PrismaClient,
    callback: TransactionCallback<T>,
    options?: MutationTransactionOptions,
  ): Promise<T> {
    return prisma.$transaction(async (transaction) => {
      await this.acquireShared(transaction);
      return callback(transaction);
    }, {
      ...options,
      timeout: Math.max(options?.timeout ?? 0, MUTATION_GATE_TRANSACTION_TIMEOUT_MS),
    });
  }

  async runExclusive<T>(
    prisma: PrismaClient,
    callback: TransactionCallback<T>,
    options?: MutationTransactionOptions,
  ): Promise<T> {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL lock_timeout = '${MUTATION_GATE_LOCK_TIMEOUT}'`);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${MUTATION_GATE_LOCK_KEY})`;
      return callback(transaction);
    }, {
      ...options,
      timeout: Math.max(options?.timeout ?? 0, MUTATION_GATE_TRANSACTION_TIMEOUT_MS),
    });
  }

  private async acquireShared(transaction: Prisma.TransactionClient): Promise<void> {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock_shared(${MUTATION_GATE_LOCK_KEY})`;
  }
}
