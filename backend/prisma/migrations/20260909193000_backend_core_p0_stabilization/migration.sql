-- CreateEnum
CREATE TYPE "InventoryReferenceType" AS ENUM ('ORDER', 'PURCHASE_ORDER', 'RECONCILIATION');

-- CreateEnum
CREATE TYPE "InventoryMovementKind" AS ENUM (
  'SALE_DEDUCTION',
  'SALE_CANCELLATION_RESTORATION',
  'SALE_REOPEN_DEDUCTION',
  'CHECKOUT_DEDUCTION',
  'PURCHASE_ORDER_RECEIPT',
  'RECONCILIATION_BASELINE_DEDUCTION',
  'RECONCILIATION_BASELINE_RESTORATION'
);

-- CreateEnum
CREATE TYPE "OrderInventoryPolicy" AS ENUM ('UNKNOWN', 'NOT_APPLICABLE', 'LEDGER_MANAGED', 'TRANSFERRED');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "inventoryPolicy" "OrderInventoryPolicy" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "inventoryEffectId" TEXT;

-- AlterTable
ALTER TABLE "InventoryHistory"
  ADD COLUMN "referenceType" "InventoryReferenceType",
  ADD COLUMN "referenceId" TEXT,
  ADD COLUMN "movementKind" "InventoryMovementKind",
  ADD COLUMN "operationId" TEXT,
  ADD COLUMN "inventoryEffectId" TEXT,
  ADD COLUMN "compensatesMovementId" TEXT;

-- Historical orders retain the migration-only UNKNOWN policy and no ownership pointer.
UPDATE "Order"
SET "inventoryPolicy" = 'UNKNOWN', "inventoryEffectId" = NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_inventoryEffectId_key" ON "Order"("inventoryEffectId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryHistory_compensatesMovementId_key" ON "InventoryHistory"("compensatesMovementId");

-- CreateIndex
CREATE INDEX "InventoryHistory_referenceType_referenceId_idx" ON "InventoryHistory"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryHistory_inventoryEffectId_idx" ON "InventoryHistory"("inventoryEffectId");

-- CreateIndex
CREATE INDEX "InventoryHistory_operationId_idx" ON "InventoryHistory"("operationId");

-- AddForeignKey
ALTER TABLE "InventoryHistory"
  ADD CONSTRAINT "InventoryHistory_compensatesMovementId_fkey"
  FOREIGN KEY ("compensatesMovementId") REFERENCES "InventoryHistory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce that only the active ledger owner holds an effect pointer.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_inventoryPolicy_inventoryEffectId_check"
  CHECK (
    ("inventoryPolicy" = 'LEDGER_MANAGED' AND "inventoryEffectId" IS NOT NULL)
    OR ("inventoryPolicy" <> 'LEDGER_MANAGED' AND "inventoryEffectId" IS NULL)
  );
