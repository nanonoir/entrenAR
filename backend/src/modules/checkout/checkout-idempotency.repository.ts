import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { CheckoutIdempotencyStatus } from "../../generated/prisma/enums";
import type { TransactionClient } from "./checkout-cart.repository";

export interface IdempotencyClaim {
  created: boolean;
  record: CheckoutIdempotencyRecord;
}

export interface CheckoutIdempotencyRecord {
  completedAt: Date | null;
  id: string;
  idempotencyKey: string;
  orderId: string | null;
  ownerKey: string;
  requestHash: string;
  responseSnapshot: Prisma.JsonValue | null;
  status: CheckoutIdempotencyStatus;
}

@Injectable()
export class CheckoutIdempotencyRepository {
  async idempotencyByOwnerAndKey(
    transaction: TransactionClient,
    ownerKey: string,
    idempotencyKey: string,
  ): Promise<CheckoutIdempotencyRecord | null> {
    return transaction.checkoutIdempotencyKey.findUnique({
      where: { ownerKey_idempotencyKey: { idempotencyKey, ownerKey } },
    });
  }

  async claimIdempotency(
    transaction: TransactionClient,
    ownerKey: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<IdempotencyClaim> {
    const inserted = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "CheckoutIdempotencyKey" ("id", "ownerKey", "idempotencyKey", "requestHash", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${ownerKey}, ${idempotencyKey}, ${requestHash}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("ownerKey", "idempotencyKey") DO NOTHING
      RETURNING "id"
    `);

    if (inserted[0]) {
      const record = await transaction.checkoutIdempotencyKey.findUnique({ where: { id: inserted[0].id } });
      if (!record) throw new Error("Created checkout idempotency record was not found.");
      return { created: true, record };
    }

    const record = await this.idempotencyByOwnerAndKey(transaction, ownerKey, idempotencyKey);
    if (!record) throw new Error("Checkout idempotency conflict could not be resolved.");
    return { created: false, record };
  }

  async completeIdempotency(
    transaction: TransactionClient,
    id: string,
    orderId: string,
    responseSnapshot: Prisma.InputJsonValue,
    completedAt: Date,
  ): Promise<CheckoutIdempotencyRecord> {
    return transaction.checkoutIdempotencyKey.update({
      data: {
        completedAt,
        orderId,
        responseSnapshot,
        status: CheckoutIdempotencyStatus.COMPLETED,
      },
      where: { id },
    });
  }

  async failIdempotency(transaction: TransactionClient, id: string): Promise<void> {
    await transaction.checkoutIdempotencyKey.update({
      data: { status: CheckoutIdempotencyStatus.FAILED },
      where: { id },
    });
  }
}

export function hashCheckoutRequest(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}
