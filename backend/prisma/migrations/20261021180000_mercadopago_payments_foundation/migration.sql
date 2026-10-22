-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('SUBMITTING', 'UNKNOWN', 'PROCESSING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "PaymentNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'QUARANTINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_REJECTED';
ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_EXPIRED';
ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_PARTIALLY_REFUNDED';
ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_REFUNDED';
ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_CHARGED_BACK';
ALTER TYPE "OrderHistoryEventType" ADD VALUE 'PAYMENT_ATTENTION_REQUIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'CHARGED_BACK';

-- AlterTable
ALTER TABLE "OrderHistory" ADD COLUMN     "effectKey" TEXT;

-- AlterTable
ALTER TABLE "OrderPayment" ADD COLUMN     "activeAttemptId" TEXT,
ADD COLUMN     "attentionReason" TEXT,
ADD COLUMN     "attentionRequiredAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentHoldReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "provider" "PaymentProvider",
ADD COLUMN     "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "retryUntil" TIMESTAMP(3),
ADD COLUMN     "reviewStartedAt" TIMESTAMP(3),
ADD COLUMN     "rowVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "clientKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "providerIdempotencyKey" TEXT NOT NULL,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'SUBMITTING',
    "providerOrderId" TEXT,
    "providerTransactionId" TEXT,
    "providerReferenceIds" JSONB,
    "rawOrderStatus" TEXT,
    "rawOrderStatusDetail" TEXT,
    "rawTransactionStatus" TEXT,
    "rawTransactionStatusDetail" TEXT,
    "providerVersion" TEXT,
    "providerUpdatedAt" TIMESTAMP(3),
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "localVersion" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcomeAt" TIMESTAMP(3),
    "challengeCreatedAt" TIMESTAMP(3),
    "nextReconcileAt" TIMESTAMP(3),
    "reconcileLeaseUntil" TIMESTAMP(3),
    "reconcileFence" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentNotification" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "eventId" TEXT,
    "requestId" TEXT,
    "providerTimestamp" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "status" "PaymentNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptId" TEXT,
    "quarantineReason" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseFence" INTEGER NOT NULL DEFAULT 0,
    "processAttempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerIdempotencyKey_key" ON "PaymentAttempt"("providerIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerOrderId_key" ON "PaymentAttempt"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerTransactionId_key" ON "PaymentAttempt"("providerTransactionId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_nextReconcileAt_idx" ON "PaymentAttempt"("status", "nextReconcileAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_clientKey_key" ON "PaymentAttempt"("paymentId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotification_dedupKey_key" ON "PaymentNotification"("dedupKey");

-- CreateIndex
CREATE INDEX "PaymentNotification_status_nextRunAt_idx" ON "PaymentNotification"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "PaymentNotification_resourceId_idx" ON "PaymentNotification"("resourceId");

-- CreateIndex
CREATE INDEX "PaymentNotification_attemptId_idx" ON "PaymentNotification"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderHistory_effectKey_key" ON "OrderHistory"("effectKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_activeAttemptId_key" ON "OrderPayment"("activeAttemptId");

-- CreateIndex
CREATE INDEX "OrderPayment_retryUntil_idx" ON "OrderPayment"("retryUntil");

-- CreateIndex
CREATE INDEX "OrderPayment_attentionRequiredAt_idx" ON "OrderPayment"("attentionRequiredAt");

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_activeAttemptId_fkey" FOREIGN KEY ("activeAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "OrderPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Provider identity is write-once: it may be set from NULL once and never changed or cleared.
-- Snapshot columns stay immutable; the new summary columns remain mutable.
CREATE OR REPLACE FUNCTION "prevent_order_payment_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."paymentMethodId" IS DISTINCT FROM OLD."paymentMethodId"
    OR NEW."paymentOptionId" IS DISTINCT FROM OLD."paymentOptionId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."paymentMethodSnapshot" IS DISTINCT FROM OLD."paymentMethodSnapshot"
    OR NEW."bankTransferSnapshot" IS DISTINCT FROM OLD."bankTransferSnapshot" THEN
    RAISE EXCEPTION 'Order payment snapshots are immutable';
  END IF;

  IF OLD."provider" IS NOT NULL AND NEW."provider" IS DISTINCT FROM OLD."provider" THEN
    RAISE EXCEPTION 'Order payment provider is write-once';
  END IF;

  RETURN NEW;
END;
$$;

-- PaymentAttempt identity columns are write-once.
CREATE FUNCTION "prevent_payment_attempt_identity_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."paymentId" IS DISTINCT FROM OLD."paymentId"
    OR NEW."attemptNumber" IS DISTINCT FROM OLD."attemptNumber"
    OR NEW."clientKey" IS DISTINCT FROM OLD."clientKey"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."providerIdempotencyKey" IS DISTINCT FROM OLD."providerIdempotencyKey"
    OR NEW."expectedAmount" IS DISTINCT FROM OLD."expectedAmount"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR (OLD."providerOrderId" IS NOT NULL AND NEW."providerOrderId" IS DISTINCT FROM OLD."providerOrderId")
    OR (OLD."providerTransactionId" IS NOT NULL AND NEW."providerTransactionId" IS DISTINCT FROM OLD."providerTransactionId") THEN
    RAISE EXCEPTION 'Payment attempt identity is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "PaymentAttempt_identity_immutable"
  BEFORE UPDATE ON "PaymentAttempt"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_payment_attempt_identity_mutation"();

-- At most one unsettled attempt per payment.
CREATE UNIQUE INDEX "PaymentAttempt_one_unsettled_per_payment_key"
  ON "PaymentAttempt"("paymentId")
  WHERE "status" IN ('SUBMITTING', 'UNKNOWN', 'PROCESSING', 'ACTION_REQUIRED');

-- At most one successful attempt (including refund/dispute descendants) per payment.
CREATE UNIQUE INDEX "PaymentAttempt_one_successful_per_payment_key"
  ON "PaymentAttempt"("paymentId")
  WHERE "status" IN ('APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK');

-- Due-work indexes.
CREATE INDEX "PaymentAttempt_due_reconciliation_idx"
  ON "PaymentAttempt"("nextReconcileAt")
  WHERE "status" IN ('SUBMITTING', 'UNKNOWN', 'PROCESSING', 'ACTION_REQUIRED');

CREATE INDEX "PaymentNotification_unresolved_due_idx"
  ON "PaymentNotification"("nextRunAt")
  WHERE "status" IN ('PENDING', 'PROCESSING');

CREATE INDEX "OrderPayment_retry_deadline_idx"
  ON "OrderPayment"("retryUntil")
  WHERE "retryUntil" IS NOT NULL;

-- Money and counter checks.
ALTER TABLE "OrderPayment"
  ADD CONSTRAINT "OrderPayment_refunded_amount_bounds_check"
    CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "amount"),
  ADD CONSTRAINT "OrderPayment_row_version_non_negative_check"
    CHECK ("rowVersion" >= 0);

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_expected_amount_positive_check"
    CHECK ("expectedAmount" > 0),
  ADD CONSTRAINT "PaymentAttempt_refunded_amount_bounds_check"
    CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "expectedAmount"),
  ADD CONSTRAINT "PaymentAttempt_attempt_number_positive_check"
    CHECK ("attemptNumber" >= 1),
  ADD CONSTRAINT "PaymentAttempt_counters_non_negative_check"
    CHECK ("localVersion" >= 0 AND "reconcileFence" >= 0 AND "retryCount" >= 0);

ALTER TABLE "PaymentNotification"
  ADD CONSTRAINT "PaymentNotification_counters_non_negative_check"
    CHECK ("leaseFence" >= 0 AND "processAttempts" >= 0);